import { computeTierProgressFromLadder, type TierProgressDto } from './xp-tier-ladder.util';
import { XP_TIER_GOLD, XP_TIER_SILVER } from './xp-rewards';

export type { TierProgressDto };

/** Default ladder when CMS has no tier rows (local dev / pre-seed). */
const FALLBACK_LADDER = [
  { rewardKey: 'tier.base', displayName: 'Bronze', minLifetimeXp: 0 },
  { rewardKey: 'tier.silver', displayName: 'Silver', minLifetimeXp: XP_TIER_SILVER },
  { rewardKey: 'tier.gold', displayName: 'Gold', minLifetimeXp: XP_TIER_GOLD },
];

/** @deprecated Use {@link computeTierProgressFromLadder} with CMS ladder. */
export function computeTierProgress(totalXp: number): TierProgressDto {
  return computeTierProgressFromLadder(totalXp, FALLBACK_LADDER);
}

export { computeTierProgressFromLadder };
