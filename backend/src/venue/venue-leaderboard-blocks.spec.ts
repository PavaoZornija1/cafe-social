jest.mock('./geofence', () => ({}));
import { VenueService } from './venue.service';

describe('leaderboard blocking', () => {
  const prisma = {
    player: { findFirst: jest.fn() },
    playerBlock: { findMany: jest.fn() },
    playerVenueStats: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const venues = { findById: jest.fn() };
  const service = new VenueService(venues as never, prisma as never);
  beforeEach(() => jest.resetAllMocks());
  it('preserves public reads without looking up account data', async () => {
    await expect(
      service.hiddenLeaderboardPlayerIds(undefined),
    ).resolves.toEqual([]);
    expect(prisma.player.findFirst).not.toHaveBeenCalled();
  });
  it('hides both players blocked by the viewer and players who blocked the viewer', async () => {
    prisma.player.findFirst.mockResolvedValue({ id: 'viewer' });
    prisma.playerBlock.findMany
      .mockResolvedValueOnce([{ blockedId: 'outgoing' }])
      .mockResolvedValueOnce([{ blockerId: 'incoming' }]);
    await expect(
      service.hiddenLeaderboardPlayerIds({ email: 'viewer@example.test' }),
    ).resolves.toEqual(['outgoing', 'incoming']);
    expect(prisma.playerBlock.findMany).toHaveBeenCalledWith({
      where: { blockerId: 'viewer' },
      select: { blockedId: true },
    });
    expect(prisma.playerBlock.findMany).toHaveBeenCalledWith({
      where: { blockedId: 'viewer' },
      select: { blockerId: true },
    });
  });
  it.each(['global', 'country', 'city'])(
    'excludes blocked players before the %s ranking limit',
    async (scope) => {
      prisma.$queryRaw.mockResolvedValue([]);
      if (scope === 'global')
        await service.globalXpLeaderboard(50, ['blocked']);
      if (scope === 'country')
        await service.countryXpLeaderboard('BA', 50, ['blocked']);
      if (scope === 'city')
        await service.cityXpLeaderboard('Sarajevo', 'BA', 50, ['blocked']);
      const sql = prisma.$queryRaw.mock.calls[0][0];
      expect(sql.sql.indexOf('p.id NOT IN')).toBeLessThan(
        sql.sql.indexOf('LIMIT'),
      );
      expect(sql.values).toContain('blocked');
      expect(sql.sql).not.toContain('blocked');
    },
  );
  it('also excludes blocked players in venue rankings', async () => {
    venues.findById.mockResolvedValue({ id: 'v1', locked: false });
    await service.venueXpLeaderboard('v1', 50, ['blocked']);
    expect(prisma.playerVenueStats.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { venueId: 'v1', playerId: { notIn: ['blocked'] } },
      }),
    );
  });
});
