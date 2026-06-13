import { computeTierProgressFromLadder } from './xp-tier-ladder.util';

describe('computeTierProgressFromLadder', () => {
  const ladder = [
    { rewardKey: 'tier.base', displayName: 'Bronze', minLifetimeXp: 0 },
    { rewardKey: 'tier.silver', displayName: 'Silver', minLifetimeXp: 800 },
    { rewardKey: 'tier.gold', displayName: 'Gold', minLifetimeXp: 2000 },
  ];

  it('shows Bronze below Silver threshold', () => {
    const p = computeTierProgressFromLadder(799, ladder);
    expect(p.tierLabel).toBe('Bronze');
    expect(p.nextTierName).toBe('Silver');
    expect(p.nextTierXpThreshold).toBe(800);
  });

  it('shows Silver between Silver and Gold', () => {
    const p = computeTierProgressFromLadder(850, ladder);
    expect(p.tierLabel).toBe('Silver');
    expect(p.nextTierName).toBe('Gold');
    expect(p.nextTierXpThreshold).toBe(2000);
  });

  it('shows Gold at top tier with no next rung', () => {
    const p = computeTierProgressFromLadder(2500, ladder);
    expect(p.tierLabel).toBe('Gold');
    expect(p.nextTierName).toBeNull();
    expect(p.nextTierXpThreshold).toBeNull();
  });

  it('falls back when ladder is empty', () => {
    const p = computeTierProgressFromLadder(100, []);
    expect(p.tierLabel).toBe('Bronze');
    expect(p.nextTierName).toBeNull();
  });
});
