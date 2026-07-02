import { Audio } from 'expo-av';

import { FEEDBACK_SOUND_SOURCES, type FeedbackSoundId } from './feedbackSounds';

/** SFX sit on top of BGM — keep them slightly softer than full scale. */
export const SFX_VOLUME = 0.88;

/** Polyphonic pools — rapid events (brawler hits, word guesses) get their own voice. */
const SOUND_POOL_SIZE: Partial<Record<FeedbackSoundId, number>> = {
  brawlerHit: 4,
  brawlerKo: 2,
  brawlerPowerup: 2,
  correct: 3,
  wrong: 3,
};

const soundPools = new Map<FeedbackSoundId, Audio.Sound[]>();
const poolCursor = new Map<FeedbackSoundId, number>();
const monoSounds = new Map<FeedbackSoundId, Audio.Sound>();

function poolSize(id: FeedbackSoundId): number {
  return SOUND_POOL_SIZE[id] ?? 1;
}

function usesPool(id: FeedbackSoundId): boolean {
  return (SOUND_POOL_SIZE[id] ?? 1) > 1;
}

async function createVoice(id: FeedbackSoundId): Promise<Audio.Sound> {
  const { sound } = await Audio.Sound.createAsync(FEEDBACK_SOUND_SOURCES[id], {
    shouldPlay: false,
    volume: SFX_VOLUME,
  });
  return sound;
}

export async function preloadFeedbackVoices(): Promise<void> {
  const ids = Object.keys(FEEDBACK_SOUND_SOURCES) as FeedbackSoundId[];
  await Promise.all(
    ids.map(async (id) => {
      if (usesPool(id)) {
        if (soundPools.has(id)) return;
        const size = poolSize(id);
        const voices = await Promise.all(
          Array.from({ length: size }, () => createVoice(id)),
        );
        soundPools.set(id, voices);
        poolCursor.set(id, 0);
        return;
      }
      if (monoSounds.has(id)) return;
      try {
        monoSounds.set(id, await createVoice(id));
      } catch {
        /* skip missing asset */
      }
    }),
  );
}

export async function unloadFeedbackVoices(): Promise<void> {
  const all = [
    ...monoSounds.values(),
    ...[...soundPools.values()].flat(),
  ];
  monoSounds.clear();
  soundPools.clear();
  poolCursor.clear();
  await Promise.all(
    all.map(async (sound) => {
      try {
        await sound.unloadAsync();
      } catch {
        /* */
      }
    }),
  );
}

async function nextPoolVoice(id: FeedbackSoundId): Promise<Audio.Sound | null> {
  let pool = soundPools.get(id);
  if (!pool?.length) {
    try {
      const voice = await createVoice(id);
      pool = [voice];
      soundPools.set(id, pool);
      poolCursor.set(id, 0);
    } catch {
      return null;
    }
  }
  const cursor = poolCursor.get(id) ?? 0;
  const voice = pool[cursor % pool.length]!;
  poolCursor.set(id, (cursor + 1) % pool.length);
  return voice;
}

async function playVoice(sound: Audio.Sound, allowInterrupt: boolean): Promise<void> {
  try {
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying && !allowInterrupt) return;
    if (status.isPlaying) {
      await sound.stopAsync();
    }
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    /* */
  }
}

export async function playFeedbackSoundId(id: FeedbackSoundId): Promise<void> {
  if (usesPool(id)) {
    const voice = await nextPoolVoice(id);
    if (!voice) return;
    await playVoice(voice, true);
    return;
  }

  let sound = monoSounds.get(id);
  if (!sound) {
    try {
      sound = await createVoice(id);
      monoSounds.set(id, sound);
    } catch {
      return;
    }
  }
  await playVoice(sound, false);
}
