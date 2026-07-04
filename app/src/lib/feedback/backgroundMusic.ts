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

const CROSSFADE_MS = 650;
const FADE_OUT_MS = 400;
const FADE_STEPS = 10;

const SILENT_ROUTES = new Set(['Login', 'SignUp', 'Onboarding']);

/** Intro + live match screens use the upbeat game loop; lobbies stay on café home. */
const GAME_MUSIC_ROUTES = new Set(['GameLaunch', 'WordGame', 'BrawlerArena']);

let musicSound: Audio.Sound | null = null;
let activeTrack: BackgroundMusicTrack | null = null;
let desiredTrack: BackgroundMusicTrack | null = null;
let appStateSub: { remove: () => void } | null = null;
let appState: AppStateStatus = AppState.currentState;
let fadeGeneration = 0;
let duckGeneration = 0;
let duckTimer: ReturnType<typeof setTimeout> | null = null;
let crossfadeInFlight: Promise<void> | null = null;

function targetVolume(track: BackgroundMusicTrack): number {
  return TRACK_VOLUME[track];
}

function clearDuckTimer(): void {
  if (duckTimer) {
    clearTimeout(duckTimer);
    duckTimer = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setMusicVolume(sound: Audio.Sound, volume: number): Promise<void> {
  try {
    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      await sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
    }
  } catch {
    /* */
  }
}

async function fadeSoundVolume(
  sound: Audio.Sound,
  from: number,
  to: number,
  ms: number,
  generation: number,
): Promise<void> {
  const steps = Math.max(4, FADE_STEPS);
  const stepMs = ms / steps;
  for (let i = 1; i <= steps; i++) {
    if (generation !== fadeGeneration) return;
    const t = i / steps;
    await setMusicVolume(sound, from + (to - from) * t);
    await sleep(stepMs);
  }
}

async function stopAndUnload(sound: Audio.Sound): Promise<void> {
  try {
    await sound.stopAsync();
    await sound.unloadAsync();
  } catch {
    /* */
  }
}

/**
 * Café home loop on lobbies and tabs; game loop on the launch intro and live matches.
 * Auth/onboarding stay silent.
 */
export function trackForRoute(routeName: string | undefined): BackgroundMusicTrack | null {
  if (!routeName || SILENT_ROUTES.has(routeName)) return null;
  if (GAME_MUSIC_ROUTES.has(routeName)) return 'game';
  return 'home';
}

async function unloadMusicImmediate(): Promise<void> {
  fadeGeneration += 1;
  clearDuckTimer();
  if (!musicSound) return;
  const s = musicSound;
  musicSound = null;
  activeTrack = null;
  await stopAndUnload(s);
}

async function fadeOutAndUnload(): Promise<void> {
  if (!musicSound || !activeTrack) {
    await unloadMusicImmediate();
    return;
  }
  const gen = ++fadeGeneration;
  const s = musicSound;
  const track = activeTrack;
  const from = targetVolume(track);
  musicSound = null;
  activeTrack = null;
  clearDuckTimer();
  await fadeSoundVolume(s, from, 0, FADE_OUT_MS, gen);
  if (gen === fadeGeneration) {
    await stopAndUnload(s);
  }
}

async function loadTrackSound(track: BackgroundMusicTrack): Promise<Audio.Sound> {
  const { sound } = await Audio.Sound.createAsync(getMusicTrackSources()[track], {
    isLooping: true,
    shouldPlay: false,
    volume: 0,
  });
  return sound;
}

async function crossfadeToTrack(track: BackgroundMusicTrack): Promise<void> {
  if (musicSound && activeTrack === track) {
    const status = await musicSound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await musicSound.playAsync();
    }
    const vol = targetVolume(track);
    await setMusicVolume(musicSound, vol);
    return;
  }

  const gen = ++fadeGeneration;
  clearDuckTimer();
  const outgoing = musicSound;
  const outgoingTrack = activeTrack;
  const incoming = await loadTrackSound(track);
  musicSound = incoming;
  activeTrack = track;

  await incoming.playAsync();

  if (!outgoing || !outgoingTrack) {
    await fadeSoundVolume(incoming, 0, targetVolume(track), CROSSFADE_MS, gen);
    return;
  }

  const outFrom = targetVolume(outgoingTrack);
  const inTo = targetVolume(track);
  const steps = Math.max(4, FADE_STEPS);
  const stepMs = CROSSFADE_MS / steps;
  for (let i = 1; i <= steps; i++) {
    if (gen !== fadeGeneration) {
      await stopAndUnload(incoming);
      return;
    }
    const t = i / steps;
    await setMusicVolume(outgoing, outFrom * (1 - t));
    await setMusicVolume(incoming, inTo * t);
    await sleep(stepMs);
  }

  if (gen === fadeGeneration) {
    await stopAndUnload(outgoing);
  }
}

function ensureAppStateListener(): void {
  if (appStateSub || Platform.OS === 'web') return;
  appStateSub = AppState.addEventListener('change', (next) => {
    appState = next;
    if (next === 'active') {
      void syncBackgroundMusic(desiredTrack);
    } else {
      void fadeOutAndUnload();
    }
  });
}

export async function syncBackgroundMusic(track: BackgroundMusicTrack | null): Promise<void> {
  desiredTrack = track;
  ensureAppStateListener();

  if (Platform.OS === 'web') return;
  if (!getFeedbackPrefs().backgroundMusicEnabled || track === null || appState !== 'active') {
    if (!getFeedbackPrefs().backgroundMusicEnabled) {
      desiredTrack = null;
    }
    crossfadeInFlight = fadeOutAndUnload();
    await crossfadeInFlight;
    crossfadeInFlight = null;
    return;
  }

  try {
    await ensureAudioSession();
    crossfadeInFlight = crossfadeToTrack(track);
    await crossfadeInFlight;
  } catch {
    /* */
  } finally {
    crossfadeInFlight = null;
  }
}

/** Briefly lower BGM so prominent SFX read clearly; restores smoothly. */
export function duckBackgroundMusic(duckFactor = 0.52, holdMs = 950): void {
  if (Platform.OS === 'web' || !musicSound || !activeTrack) return;
  const track = activeTrack;
  const base = targetVolume(track);
  const ducked = base * duckFactor;
  const gen = ++duckGeneration;
  clearDuckTimer();

  void setMusicVolume(musicSound, ducked);
  duckTimer = setTimeout(() => {
    if (gen !== duckGeneration || musicSound == null || activeTrack !== track) return;
    void (async () => {
      const steps = 5;
      const stepMs = 85;
      for (let i = 1; i <= steps; i++) {
        if (gen !== duckGeneration || musicSound == null || activeTrack !== track) return;
        const t = i / steps;
        await setMusicVolume(musicSound, ducked + (base - ducked) * t);
        await sleep(stepMs);
      }
    })();
  }, holdMs);
}

export async function stopBackgroundMusic(): Promise<void> {
  desiredTrack = null;
  await fadeOutAndUnload();
}

export function syncBackgroundMusicForRoute(routeName: string | undefined): void {
  if (!getFeedbackPrefs().backgroundMusicEnabled) {
    desiredTrack = null;
    void stopBackgroundMusic();
    return;
  }
  void syncBackgroundMusic(trackForRoute(routeName));
}
