import { XP_TIER_GOLD, XP_TIER_SILVER } from './xp-rewards';
import { computeTierProgress, tierLabelFromTotalXp } from './xp-tier.util';

describe('tierLabelFromTotalXp', () => {
  it('returns Bronze below silver threshold', () => {
    expect(tierLabelFromTotalXp(0)).toBe('Bronze');
    expect(tierLabelFromTotalXp(XP_TIER_SILVER - 1)).toBe('Bronze');
  });

  it('returns Silver between silver and gold', () => {
    expect(tierLabelFromTotalXp(XP_TIER_SILVER)).toBe('Silver');
    expect(tierLabelFromTotalXp(XP_TIER_GOLD - 1)).toBe('Silver');
  });

  it('returns Gold at or above gold threshold', () => {
    expect(tierLabelFromTotalXp(XP_TIER_GOLD)).toBe('Gold');
    expect(tierLabelFromTotalXp(XP_TIER_GOLD + 1000)).toBe('Gold');
  });
});

describe('computeTierProgress', () => {
  it('progresses toward Silver from Bronze', () => {
    const p = computeTierProgress(100);
    expect(p.tierLabel).toBe('Bronze');
    expect(p.nextTierName).toBe('Silver');
    expect(p.nextTierXpThreshold).toBe(XP_TIER_SILVER);
  });

  it('progresses toward Gold from Silver', () => {
    const p = computeTierProgress(XP_TIER_SILVER + 10);
    expect(p.tierLabel).toBe('Silver');
    expect(p.nextTierName).toBe('Gold');
    expect(p.nextTierXpThreshold).toBe(XP_TIER_GOLD);
  });

  it('has no next tier at Gold', () => {
    const p = computeTierProgress(XP_TIER_GOLD);
    expect(p.tierLabel).toBe('Gold');
    expect(p.nextTierName).toBeNull();
    expect(p.nextTierXpThreshold).toBeNull();
  });
});
