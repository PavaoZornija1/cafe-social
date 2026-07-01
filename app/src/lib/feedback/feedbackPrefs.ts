import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_KEY = 'cafe_social_sound_effects_enabled';
const HAPTICS_KEY = 'cafe_social_haptics_enabled';
const MUSIC_KEY = 'cafe_social_background_music_enabled';

export type FeedbackPrefs = {
  soundEffectsEnabled: boolean;
  hapticsEnabled: boolean;
  backgroundMusicEnabled: boolean;
};

const DEFAULT_PREFS: FeedbackPrefs = {
  soundEffectsEnabled: true,
  hapticsEnabled: true,
  backgroundMusicEnabled: true,
};

let cachedPrefs: FeedbackPrefs = { ...DEFAULT_PREFS };
let loadPromise: Promise<FeedbackPrefs> | null = null;

function parseBool(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true';
}

export function getFeedbackPrefs(): FeedbackPrefs {
  return cachedPrefs;
}

export async function loadFeedbackPrefs(): Promise<FeedbackPrefs> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([SOUND_KEY, HAPTICS_KEY, MUSIC_KEY]);
        const map = Object.fromEntries(pairs);
        cachedPrefs = {
          soundEffectsEnabled: parseBool(map[SOUND_KEY] ?? null, true),
          hapticsEnabled: parseBool(map[HAPTICS_KEY] ?? null, true),
          backgroundMusicEnabled: parseBool(map[MUSIC_KEY] ?? null, true),
        };
      } catch {
        cachedPrefs = { ...DEFAULT_PREFS };
      }
      return cachedPrefs;
    })();
  }
  return loadPromise;
}

export async function setSoundEffectsEnabled(enabled: boolean): Promise<void> {
  cachedPrefs = { ...cachedPrefs, soundEffectsEnabled: enabled };
  await AsyncStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
}

export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  cachedPrefs = { ...cachedPrefs, hapticsEnabled: enabled };
  await AsyncStorage.setItem(HAPTICS_KEY, enabled ? '1' : '0');
}

export async function setBackgroundMusicEnabled(enabled: boolean): Promise<void> {
  cachedPrefs = { ...cachedPrefs, backgroundMusicEnabled: enabled };
  await AsyncStorage.setItem(MUSIC_KEY, enabled ? '1' : '0');
}
