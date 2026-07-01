import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

let audioModeReady = false;

/** One shared session so BGM and SFX play together without ducking or pausing each other. */
export async function ensureAudioSession(): Promise<void> {
  if (audioModeReady || Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    audioModeReady = true;
  } catch {
    /* non-fatal */
  }
}
