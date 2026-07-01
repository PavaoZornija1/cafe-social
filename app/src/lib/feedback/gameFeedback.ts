import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';

import { ensureAudioSession } from './audioSession';
import { FEEDBACK_SOUND_SOURCES, type FeedbackSoundId } from './feedbackSounds';
import { getFeedbackPrefs, loadFeedbackPrefs } from './feedbackPrefs';

export type FeedbackEvent =
  | 'correct'
  | 'wrong'
  | 'dailySolved'
  | 'dailyFailed'
  | 'timerUrgent'
  | 'timerUp'
  | 'matchWin'
  | 'matchLoss'
  | 'lobbyReady'
  | 'lobbyJoined'
  | 'lobbyStart'
  | 'lobbyFound'
  | 'lobbyLeft'
  | 'brawlerHit'
  | 'brawlerKo'
  | 'perkRedeemed'
  | 'checkIn';

type HapticKind = 'success' | 'error' | 'warning' | 'light' | 'medium';

const EVENT_SOUND: Record<FeedbackEvent, FeedbackSoundId> = {
  correct: 'correct',
  wrong: 'wrong',
  dailySolved: 'dailySolved',
  dailyFailed: 'dailyFailed',
  timerUrgent: 'timerUrgent',
  timerUp: 'timerUp',
  matchWin: 'matchWin',
  matchLoss: 'matchLoss',
  lobbyReady: 'lobbyReady',
  lobbyJoined: 'lobbyJoined',
  lobbyStart: 'lobbyStart',
  lobbyFound: 'lobbyFound',
  lobbyLeft: 'lobbyLeft',
  brawlerHit: 'brawlerHit',
  brawlerKo: 'brawlerKo',
  perkRedeemed: 'perkRedeemed',
  checkIn: 'checkIn',
};

const EVENT_HAPTIC: Record<FeedbackEvent, HapticKind> = {
  correct: 'success',
  wrong: 'error',
  dailySolved: 'success',
  dailyFailed: 'warning',
  timerUrgent: 'light',
  timerUp: 'warning',
  matchWin: 'success',
  matchLoss: 'light',
  lobbyReady: 'light',
  lobbyJoined: 'light',
  lobbyStart: 'medium',
  lobbyFound: 'success',
  lobbyLeft: 'light',
  brawlerHit: 'light',
  brawlerKo: 'medium',
  perkRedeemed: 'success',
  checkIn: 'success',
};

let reduceMotionEnabled = false;
let reduceMotionSub: { remove: () => void } | null = null;
const loadedSounds = new Map<FeedbackSoundId, Audio.Sound>();
let initDone = false;

/** SFX sit on top of BGM — keep them slightly softer than full scale. */
const SFX_VOLUME = 0.88;

async function refreshReduceMotion(): Promise<void> {
  if (Platform.OS === 'web') {
    reduceMotionEnabled = false;
    return;
  }
  try {
    reduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    reduceMotionEnabled = false;
  }
}

export async function initGameFeedback(): Promise<void> {
  if (initDone) return;
  initDone = true;
  await loadFeedbackPrefs();
  await ensureAudioSession();
  await refreshReduceMotion();
  if (Platform.OS !== 'web' && !reduceMotionSub) {
    reduceMotionSub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionEnabled = enabled;
    });
  }
}

export async function preloadFeedbackSounds(): Promise<void> {
  if (Platform.OS === 'web') return;
  await ensureAudioSession();
  const ids = Object.keys(FEEDBACK_SOUND_SOURCES) as FeedbackSoundId[];
  await Promise.all(
    ids.map(async (id) => {
      if (loadedSounds.has(id)) return;
      try {
        const { sound } = await Audio.Sound.createAsync(FEEDBACK_SOUND_SOURCES[id], {
          shouldPlay: false,
          volume: SFX_VOLUME,
        });
        loadedSounds.set(id, sound);
      } catch {
        /* skip missing asset */
      }
    }),
  );
}

export async function unloadFeedbackSounds(): Promise<void> {
  const sounds = [...loadedSounds.values()];
  loadedSounds.clear();
  await Promise.all(
    sounds.map(async (sound) => {
      try {
        await sound.unloadAsync();
      } catch {
        /* */
      }
    }),
  );
}

async function playSoundId(id: FeedbackSoundId): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!getFeedbackPrefs().soundEffectsEnabled) return;
  await ensureAudioSession();
  let sound = loadedSounds.get(id);
  if (!sound) {
    try {
      const created = await Audio.Sound.createAsync(FEEDBACK_SOUND_SOURCES[id], {
        shouldPlay: true,
        volume: SFX_VOLUME,
      });
      sound = created.sound;
      loadedSounds.set(id, sound);
      created.sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          void sound?.setPositionAsync(0);
        }
      });
      return;
    } catch {
      return;
    }
  }
  try {
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    /* */
  }
}

async function runHaptic(kind: HapticKind): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!getFeedbackPrefs().hapticsEnabled) return;
  if (reduceMotionEnabled) return;
  try {
    switch (kind) {
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      default: {
        const _exhaustive: never = kind;
        void _exhaustive;
      }
    }
  } catch {
    /* device may block vibration */
  }
}

export function triggerFeedback(event: FeedbackEvent): void {
  void playSoundId(EVENT_SOUND[event]);
  void runHaptic(EVENT_HAPTIC[event]);
}

/** Settings preview — respects current toggles. */
export function triggerFeedbackPreview(): void {
  triggerFeedback('correct');
}
