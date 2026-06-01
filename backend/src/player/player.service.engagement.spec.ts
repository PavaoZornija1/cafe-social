import { PlayerService } from './player.service';

describe('PlayerService.getMeEngagement', () => {
  function buildService() {
    const players = {
      findByEmail: jest.fn().mockResolvedValue({
        id: 'p1',
        email: 'guest@example.com',
        username: 'guest',
        memberQrToken: 'abcdefghijklmnopqrstuv',
      }),
      create: jest.fn(),
      update: jest.fn(),
    };
    const venueStats = {};
    const prisma = {
      playerVenueVisitDay: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    const service = new PlayerService(
      players as never,
      venueStats as never,
      prisma as never,
    );
    return { service, prisma };
  }

  it('returns badges and per-venue visit stats when venueId is provided', async () => {
    const { service, prisma } = buildService();
    prisma.playerVenueVisitDay.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3);
    prisma.playerVenueVisitDay.groupBy.mockResolvedValue([
      { venueId: 'v1' },
      { venueId: 'v2' },
    ]);

    const out = await service.getMeEngagement('guest@example.com', 'v1');

    expect(out.visitsThisWeek).toBe(4);
    expect(out.distinctVenuesVisitedLast30Days).toBe(2);
    expect(out.badges).toEqual(expect.arrayContaining(['regular_this_week', 'venue_explorer']));
    expect(out.atVenue).toEqual({
      visitDaysLast30Days: 12,
      visitDaysThisWeek: 3,
    });
  });

  it('omits atVenue when venueId is not passed', async () => {
    const { service, prisma } = buildService();
    prisma.playerVenueVisitDay.count.mockResolvedValueOnce(1);
    prisma.playerVenueVisitDay.groupBy.mockResolvedValue([]);

    const out = await service.getMeEngagement('guest@example.com');

    expect(out.atVenue).toBeUndefined();
    expect(out.badges).toEqual([]);
  });
});
