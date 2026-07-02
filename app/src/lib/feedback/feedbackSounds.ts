import type { AVPlaybackSource } from 'expo-av';

export type FeedbackSoundId =
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

export const FEEDBACK_SOUND_SOURCES: Record<FeedbackSoundId, AVPlaybackSource> = {
  correct: require('../../../assets/sounds/correct.wav'),
  wrong: require('../../../assets/sounds/wrong.wav'),
  dailySolved: require('../../../assets/sounds/daily_solved.wav'),
  dailyFailed: require('../../../assets/sounds/daily_failed.wav'),
  timerUrgent: require('../../../assets/sounds/timer_urgent.wav'),
  timerUp: require('../../../assets/sounds/timer_up.wav'),
  matchWin: require('../../../assets/sounds/match_win.wav'),
  matchLoss: require('../../../assets/sounds/match_loss.wav'),
  lobbyReady: require('../../../assets/sounds/lobby_ready.wav'),
  lobbyJoined: require('../../../assets/sounds/lobby_joined.wav'),
  lobbyStart: require('../../../assets/sounds/lobby_start.wav'),
  lobbyFound: require('../../../assets/sounds/lobby_found.wav'),
  lobbyLeft: require('../../../assets/sounds/lobby_left.wav'),
  brawlerHit: require('../../../assets/sounds/brawler_hit.wav'),
  brawlerKo: require('../../../assets/sounds/brawler_ko.wav'),
  brawlerPowerup: require('../../../assets/sounds/brawler_powerup.wav'),
  perkRedeemed: require('../../../assets/sounds/perk_redeemed.wav'),
  checkIn: require('../../../assets/sounds/check_in.wav'),
};
