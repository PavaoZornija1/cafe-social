export type TierLadderRung = {
  rewardKey: string;
  displayName: string;
  minLifetimeXp: number;
};

export type TierProgressDto = {
  tierLabel: string;
  nextTierXpThreshold: number | null;
  nextTierName: string | null;
};

const FALLBACK_BASE_TIER = 'Bronze';

/** Pure tier math from CMS ladder rows (sorted by caller or internally). */
export function computeTierProgressFromLadder(
  totalXp: number,
  ladder: TierLadderRung[],
): TierProgressDto {
  const rungs = [...ladder].sort((a, b) => a.minLifetimeXp - b.minLifetimeXp);
  if (rungs.length === 0) {
    return {
      tierLabel: FALLBACK_BASE_TIER,
      nextTierXpThreshold: null,
      nextTierName: null,
    };
  }

  const earned = rungs.filter((r) => totalXp >= r.minLifetimeXp);
  const current = earned.length > 0 ? earned[earned.length - 1] : undefined;
  const next = rungs.find((r) => r.minLifetimeXp > totalXp);

  return {
    tierLabel: current?.displayName ?? FALLBACK_BASE_TIER,
    nextTierXpThreshold: next?.minLifetimeXp ?? null,
    nextTierName: next?.displayName ?? null,
  };
}
