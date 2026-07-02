import { Audio } from 'expo-av';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { ensureAudioSession } from './audioSession';
import { getFeedbackPrefs } from './feedbackPrefs';
import { getMusicTrackSources, type BackgroundMusicTrack } from './musicPack';

export type { BackgroundMusicTrack } from './musicPack';

const TRACK_VOLUME: Record<BackgroundMusicTrack, number> = {
  home: 0.24,
  game: 0.34,
};

const GAME_ROUTES = new Set([
  'WordGame',
  'BrawlerArena',
  'DailyWord',
  'WordMatchWait',
  'WordVenueQueue',
  'WordLobby',
  'WordMatchJoin',
  'ChooseGame',
  'BrawlerLobby',
]);

const SILENT_ROUTES = new Set(['Login', 'SignUp', 'Onboarding']);

let musicSound: Audio.Sound | null = null;
let activeTrack: BackgroundMusicTrack | null = null;
let desiredTrack: BackgroundMusicTrack | null = null;
let appStateSub: { remove: () => void } | null = null;
let appState: AppStateStatus = AppState.currentState;

export function trackForRoute(routeName: string | undefined): BackgroundMusicTrack | null {
  if (!routeName || SILENT_ROUTES.has(routeName)) return null;
  if (GAME_ROUTES.has(routeName)) return 'game';
  return 'home';
}

async function unloadMusic(): Promise<void> {
  if (!musicSound) return;
  const s = musicSound;
  musicSound = null;
  activeTrack = null;
  try {
    await s.stopAsync();
    await s.unloadAsync();
  } catch {
    /* */
  }
}

async function loadTrack(track: BackgroundMusicTrack): Promise<Audio.Sound> {
  if (musicSound && activeTrack === track) return musicSound;
  await unloadMusic();
  const { sound } = await Audio.Sound.createAsync(getMusicTrackSources()[track], {
    isLooping: true,
    shouldPlay: false,
    volume: TRACK_VOLUME[track],
  });
  musicSound = sound;
  activeTrack = track;
  return sound;
}

function ensureAppStateListener(): void {
  if (appStateSub || Platform.OS === 'web') return;
  appStateSub = AppState.addEventListener('change', (next) => {
    appState = next;
    if (next === 'active') {
      void syncBackgroundMusic(desiredTrack);
    } else {
      void unloadMusic();
    }
  });
}

export async function syncBackgroundMusic(track: BackgroundMusicTrack | null): Promise<void> {
  desiredTrack = track;
  ensureAppStateListener();

  if (Platform.OS === 'web') return;
  if (!getFeedbackPrefs().backgroundMusicEnabled || track === null || appState !== 'active') {
    await unloadMusic();
    return;
  }

  try {
    await ensureAudioSession();
    const sound = await loadTrack(track);
    const status = await sound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await sound.playAsync();
    }
  } catch {
    /* */
  }
}

export async function stopBackgroundMusic(): Promise<void> {
  desiredTrack = null;
  await unloadMusic();
}

export function syncBackgroundMusicForRoute(routeName: string | undefined): void {
  void syncBackgroundMusic(trackForRoute(routeName));
}
