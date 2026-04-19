/** Shape of `GET /players/me/summary` (extend as backend grows). */
export type MeSummaryDto = {
  playerId?: string;
  xp: number;
  tier: string;
  /** Absolute XP threshold for the next tier (e.g. 800 → Silver, 2000 → Gold); omitted at Gold. */
  nextTierXpThreshold?: number | null;
  nextTierName?: string | null;
  completedChallenges: number;
  venuesUnlocked: number;
  discoverable?: boolean;
  totalPrivacy?: boolean;
  partnerMarketingPush?: boolean;
  matchActivityPush?: boolean;
  subscriptionActive?: boolean;
  onboardingPlayerCompletedAt?: string | null;
  onboardingStaffCompletedAt?: string | null;
};
