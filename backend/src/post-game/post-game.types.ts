export type PostGameMomentKind =
  | 'xp'
  | 'tier_up'
  | 'challenge_progress'
  | 'challenge_complete'
  | 'perk_unlocked'
  | 'platform_quest_ready';

export type PostGameMomentIcon =
  | 'trophy'
  | 'flash'
  | 'cafe'
  | 'star'
  | 'game-controller'
  | 'sparkles';

export type PostGameMomentDto = {
  kind: PostGameMomentKind;
  title: string;
  subtitle?: string | null;
  icon: PostGameMomentIcon;
  xpAmount?: number | null;
  progressCount?: number | null;
  progressTarget?: number | null;
  perkTitle?: string | null;
  tierLabel?: string | null;
  previousTierLabel?: string | null;
  nextTierName?: string | null;
};

export type PostGameSummaryParticipantDto = {
  username: string;
  score: number;
  result?: 'WIN' | 'LOSS' | 'DRAW' | 'DNF' | null;
  isYou: boolean;
  kills?: number | null;
  deaths?: number | null;
  xpGained?: number | null;
};

export type PostGameSummaryDto = {
  game: 'word' | 'brawler';
  mode?: 'solo' | 'coop' | 'versus' | null;
  won: boolean;
  showRematch?: boolean;
  participants?: PostGameSummaryParticipantDto[];
};

export type PostGamePayloadDto = {
  moments: PostGameMomentDto[];
  summary: PostGameSummaryDto;
};

export type ChallengeBumpResult = {
  challengeId: string;
  title: string;
  previousCount: number;
  progressCount: number;
  targetCount: number;
  newlyCompleted: boolean;
  perkTitle?: string | null;
  challengeXpGain: number;
  perkGranted: boolean;
};
