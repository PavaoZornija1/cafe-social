import { EventEmitter } from 'node:events';
import type { Player } from '@prisma/client';
import { PlayerService } from './player.service';
import { playerRequestContext } from './player-request-context';

function request<T>(fn: () => Promise<T>): Promise<T> {
  const response = new EventEmitter();
  return new Promise<T>((resolve, reject) => {
    playerRequestContext.middleware({} as never, response as never, () => {
      fn().then(resolve, reject).finally(() => response.emit('finish'));
    });
  });
}

function fixture() {
  const player = {
    id: 'p1', email: 'player@example.com', username: 'player', memberQrToken: 'token',
    bonusXp: 7, competitiveRankRating: 1100, wordRankRating: 1200,
    brawlerRankRating: 1300, discoverable: true, totalPrivacy: false,
    partnerMarketingPush: false, matchActivityPush: true, emailNotifications: true,
    onboardingPlayerCompletedAt: new Date('2025-01-02'), onboardingStaffCompletedAt: null,
  } as Player;
  const players = {
    findByEmail: jest.fn().mockResolvedValue(player),
    create: jest.fn(), update: jest.fn(), findDeletedAccount: jest.fn().mockResolvedValue(null),
    deleteById: jest.fn(), recordDeletedAccount: jest.fn(),
    getSummary: jest.fn().mockResolvedValue({ completedChallenges: 3, venuesUnlocked: 2 }),
  };
  const subscription = { active: true, expiresAt: new Date('2099-01-01') };
  const staff = [{ venueId: 'v2', role: 'OWNER', venueName: 'Cafe' }];
  const row = { ...player, completedChallenges: BigInt(3), venuesUnlocked: BigInt(2),
    venueXpSum: BigInt(45), subscriptionActiveValue: subscription.active,
    subscriptionExpiresAt: subscription.expiresAt };
  const prisma = { $queryRaw: jest.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce(staff) };
  const rewards = { computeTierProgress: jest.fn().mockResolvedValue({
    tierLabel: 'Bronze', nextTierXpThreshold: 100, nextTierName: 'Silver',
  }) };
  const service = new PlayerService(players as never, {} as never, prisma as never,
    rewards as never, { deleteUser: jest.fn() } as never);
  return { player, players, subscription, staff, row, prisma, rewards, service };
}

describe('home summary round trips and contract', () => {
  it('matches the previous output using two statements, and seeds player resolution', async () => {
    const f = fixture();
    const result = await request(async () => {
      const summary = await f.service.getMeSummary(f.player.email);
      expect(await f.service.findOrCreateByEmail(f.player.email)).toEqual(f.player);
      return summary;
    });
    // The former pipeline used repository counts, sum, and the subscription predicate.
    const oldCounts = await f.players.getSummary(f.player.id);
    const oldXp = 45 + f.player.bonusXp;
    const tier = await f.rewards.computeTierProgress(oldXp);
    expect(result).toEqual({ playerId: f.player.id, xp: oldXp, tier: tier.tierLabel,
      nextTierXpThreshold: tier.nextTierXpThreshold, nextTierName: tier.nextTierName,
      competitiveRankRating: f.player.competitiveRankRating, wordRankRating: f.player.wordRankRating,
      brawlerRankRating: f.player.brawlerRankRating, ...oldCounts,
      discoverable: true, totalPrivacy: false, partnerMarketingPush: false,
      matchActivityPush: true, emailNotifications: true,
      subscriptionActive: f.subscription.active && f.subscription.expiresAt.getTime() > Date.now(),
      onboardingPlayerCompletedAt: f.player.onboardingPlayerCompletedAt!.toISOString(),
      onboardingStaffCompletedAt: null, staffVenues: f.staff });
    expect(f.prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(f.players.findByEmail).not.toHaveBeenCalled();
    expect(() => JSON.stringify(result)).not.toThrow();
    const sql = f.prisma.$queryRaw.mock.calls.map(([parts]) => parts.join('?'));
    expect(sql[0]).toContain('COUNT(*)');
    expect(sql[1]).toContain('JOIN "Venue"');
    expect(sql[1]).toContain('ORDER BY s."updatedAt" DESC LIMIT 50');
  });

  it.each([null, false, true])('handles empty aggregates and subscription active=%s', async active => {
    const f = fixture();
    f.prisma.$queryRaw.mockReset().mockResolvedValueOnce([{ ...f.row,
      completedChallenges: BigInt(0), venuesUnlocked: BigInt(0), venueXpSum: null,
      subscriptionActiveValue: active, subscriptionExpiresAt: new Date('2000-01-01'),
    }]).mockResolvedValueOnce([]);
    const result = await f.service.getMeSummary(f.player.email);
    expect(result).toMatchObject({ xp: 7, completedChallenges: 0, venuesUnlocked: 0,
      subscriptionActive: false, staffVenues: [] });
    expect(f.rewards.computeTierProgress).toHaveBeenCalledWith(7);
  });
});

describe('request player resolution', () => {
  it('shares concurrent lookups within a request and isolates separate requests', async () => {
    const f = fixture();
    await request(() => Promise.all([f.service.findOrCreateByEmail(f.player.email),
      f.service.findOrCreateByEmail(f.player.email)]));
    expect(f.players.findByEmail).toHaveBeenCalledTimes(1);
    await request(() => f.service.findOrCreateByEmail(f.player.email));
    expect(f.players.findByEmail).toHaveBeenCalledTimes(2);
  });

  it('rejects cache hits after account deletion in the same request', async () => {
    const f = fixture();
    await request(async () => {
      await f.service.findOrCreateByEmail(f.player.email);
      await f.service.deleteMyAccount(f.player.email, 'clerk1');
      await expect(f.service.findOrCreateByEmail(f.player.email)).rejects.toThrow('Account deleted');
    });
    expect(f.players.recordDeletedAccount).toHaveBeenCalledWith(f.player.email, 'clerk1');
    expect(f.players.create).not.toHaveBeenCalled();
  });
});
