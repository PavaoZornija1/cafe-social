import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';

import { duckBackgroundMusic } from './backgroundMusic';
import { ensureAudioSession } from './audioSession';
import type { FeedbackSoundId } from './feedbackSounds';
import {
  playFeedbackSoundId,
  preloadFeedbackVoices,
  unloadFeedbackVoices,
} from './feedbackPlayback';
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
  | 'brawlerPowerup'
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
  brawlerPowerup: 'brawlerPowerup',
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
  brawlerPowerup: 'success',
  perkRedeemed: 'success',
  checkIn: 'success',
};

/** Min ms between the same event firing haptics (avoids brawler hit buzz). */
const EVENT_HAPTIC_COOLDOWN_MS: Partial<Record<FeedbackEvent, number>> = {
  brawlerHit: 90,
  brawlerKo: 180,
  brawlerPowerup: 250,
  correct: 120,
  wrong: 120,
  timerUrgent: 5000,
};

const HAPTIC_KIND_COOLDOWN_MS: Record<HapticKind, number> = {
  light: 65,
  medium: 95,
  success: 130,
  error: 130,
  warning: 110,
};

/** Duck BGM under these so voice / sting SFX sit on top without fighting the loop. */
const BGM_DUCK_EVENTS = new Set<FeedbackEvent>([
  'matchWin',
  'matchLoss',
  'lobbyFound',
  'lobbyStart',
  'dailySolved',
  'dailyFailed',
  'perkRedeemed',
  'checkIn',
  'brawlerKo',
  'brawlerPowerup',
]);

let reduceMotionEnabled = false;
let reduceMotionSub: { remove: () => void } | null = null;
let initDone = false;
const lastEventHapticAt = new Map<FeedbackEvent, number>();
const lastHapticKindAt = new Map<HapticKind, number>();

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
  await preloadFeedbackVoices();
}

export async function unloadFeedbackSounds(): Promise<void> {
  await unloadFeedbackVoices();
}

function shouldRunHaptic(event: FeedbackEvent, kind: HapticKind): boolean {
  const now = Date.now();
  const eventCooldown = EVENT_HAPTIC_COOLDOWN_MS[event];
  if (eventCooldown != null) {
    const lastEvent = lastEventHapticAt.get(event) ?? 0;
    if (now - lastEvent < eventCooldown) return false;
  }
  const kindCooldown = HAPTIC_KIND_COOLDOWN_MS[kind];
  const lastKind = lastHapticKindAt.get(kind) ?? 0;
  if (now - lastKind < kindCooldown) return false;
  lastEventHapticAt.set(event, now);
  lastHapticKindAt.set(kind, now);
  return true;
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

async function playEventSound(event: FeedbackEvent): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!getFeedbackPrefs().soundEffectsEnabled) return;
  await ensureAudioSession();
  await playFeedbackSoundId(EVENT_SOUND[event]);
}

export function triggerFeedback(event: FeedbackEvent): void {
  void playEventSound(event);
  if (BGM_DUCK_EVENTS.has(event) && getFeedbackPrefs().backgroundMusicEnabled) {
    duckBackgroundMusic();
  }
  const kind = EVENT_HAPTIC[event];
  if (!shouldRunHaptic(event, kind)) return;
  void runHaptic(kind);
}

/** Settings preview — respects current toggles. */
export function triggerFeedbackPreview(): void {
  triggerFeedback('correct');
}
