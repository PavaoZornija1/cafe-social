import { XP_TIER_GOLD, XP_TIER_SILVER } from './xp-rewards';

export type TierProgressDto = {
  tierLabel: string;
  nextTierXpThreshold: number | null;
  nextTierName: string | null;
};

export function tierLabelFromTotalXp(totalXp: number): string {
  if (totalXp >= XP_TIER_GOLD) return 'Gold';
  if (totalXp >= XP_TIER_SILVER) return 'Silver';
  return 'Bronze';
}

/** Progress toward the next tier: denominator is the absolute XP needed for that tier. */
export function computeTierProgress(totalXp: number): TierProgressDto {
  const tierLabel = tierLabelFromTotalXp(totalXp);
  if (totalXp >= XP_TIER_GOLD) {
    return { tierLabel, nextTierXpThreshold: null, nextTierName: null };
  }
  if (totalXp >= XP_TIER_SILVER) {
    return {
      tierLabel,
      nextTierXpThreshold: XP_TIER_GOLD,
      nextTierName: 'Gold',
    };
  }
  return {
    tierLabel,
    nextTierXpThreshold: XP_TIER_SILVER,
    nextTierName: 'Silver',
  };
}
