import { setBackgroundMusicEnabled as persistBackgroundMusicEnabled } from './feedbackPrefs';
import { stopBackgroundMusicImmediate } from './backgroundMusic';

export async function setBackgroundMusicEnabled(enabled: boolean): Promise<void> {
  await persistBackgroundMusicEnabled(enabled);
  if (!enabled) {
    await stopBackgroundMusicImmediate();
  }
}
