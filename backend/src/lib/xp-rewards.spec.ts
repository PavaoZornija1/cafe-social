import {
  BRAWLER_WIN_XP_MAX,
  BRAWLER_WIN_XP_MIN,
  BRAWLER_XP_PER_DEATH_PENALTY,
  BRAWLER_XP_PER_KILL,
  XP_GLOBAL_WIN,
  XP_TIER_GOLD,
  XP_TIER_SILVER,
  XP_VENUE_WIN,
} from './xp-rewards';

describe('xp-rewards constants', () => {
  it('has ordered tier thresholds', () => {
    expect(XP_TIER_SILVER).toBeLessThan(XP_TIER_GOLD);
  });

  it('exposes win and brawler tuning constants', () => {
    expect(XP_VENUE_WIN).toBeGreaterThan(0);
    expect(XP_GLOBAL_WIN).toBeGreaterThan(0);
    expect(BRAWLER_XP_PER_KILL).toBeGreaterThan(0);
    expect(BRAWLER_XP_PER_DEATH_PENALTY).toBeGreaterThan(0);
    expect(BRAWLER_WIN_XP_MIN).toBeLessThan(BRAWLER_WIN_XP_MAX);
  });
});
