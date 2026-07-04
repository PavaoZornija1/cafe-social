export {
  getFeedbackPrefs,
  loadFeedbackPrefs,
  setHapticsEnabled,
  setSoundEffectsEnabled,
  type FeedbackPrefs,
} from './feedbackPrefs';
export { setBackgroundMusicEnabled } from './setBackgroundMusicEnabled';
export {
  stopBackgroundMusic,
  stopBackgroundMusicImmediate,
  syncBackgroundMusic,
  syncBackgroundMusicForRoute,
  trackForRoute,
  type BackgroundMusicTrack,
} from './backgroundMusic';
export {
  initGameFeedback,
  preloadFeedbackSounds,
  triggerFeedback,
  triggerFeedbackPreview,
  unloadFeedbackSounds,
  type FeedbackEvent,
} from './gameFeedback';
