import { computeTierProgressFromLadder } from './xp-tier-ladder.util';
import { computeTierProgress } from './xp-tier.util';
import { XP_TIER_GOLD, XP_TIER_SILVER } from './xp-rewards';

describe('computeTierProgress fallback', () => {
  it('uses built-in ladder when CMS is unavailable', () => {
    const p = computeTierProgress(XP_TIER_SILVER + 10);
    expect(p.tierLabel).toBe('Silver');
    expect(p.nextTierName).toBe('Gold');
    expect(p.nextTierXpThreshold).toBe(XP_TIER_GOLD);
  });

  it('matches ladder helper for default thresholds', () => {
    const ladder = [
      { rewardKey: 'tier.base', displayName: 'Bronze', minLifetimeXp: 0 },
      { rewardKey: 'tier.silver', displayName: 'Silver', minLifetimeXp: XP_TIER_SILVER },
      { rewardKey: 'tier.gold', displayName: 'Gold', minLifetimeXp: XP_TIER_GOLD },
    ];
    expect(computeTierProgress(0)).toEqual(computeTierProgressFromLadder(0, ladder));
  });
});
