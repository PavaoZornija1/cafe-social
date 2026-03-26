/** Shape of `GET /players/me/summary` (extend as backend grows). */
export type MeSummaryDto = {
  playerId?: string;
  xp: number;
  tier: string;
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
