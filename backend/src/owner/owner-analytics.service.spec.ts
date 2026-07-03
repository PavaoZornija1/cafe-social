import { OwnerAnalyticsService } from './owner-analytics.service';

describe('OwnerAnalyticsService', () => {
  const prisma = {
    venue: { findUnique: jest.fn(), findMany: jest.fn() },
    venuePerkRedemption: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    playerVenueVisitDay: { findMany: jest.fn() },
    venueFeedEvent: { findMany: jest.fn() },
    venueFunnelEvent: { findMany: jest.fn() },
    venuePerk: { findMany: jest.fn() },
    proximityArrivalPushLog: { count: jest.fn() },
    playerVenueGeofenceEvent: { count: jest.fn() },
    playerVenuePolygonSession: { findMany: jest.fn() },
  };

  const service = new OwnerAnalyticsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.venue.findUnique.mockResolvedValue({ analyticsTimeZone: null });
    prisma.venuePerkRedemption.findMany.mockResolvedValue([
      { issuedAt: new Date('2026-06-01T12:00:00Z'), playerId: 'p1', voidedAt: null, perkId: 'perk1' },
    ]);
    prisma.venuePerkRedemption.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    prisma.venuePerkRedemption.groupBy
      .mockResolvedValueOnce([{ perkId: 'perk1', _count: { id: 3 } }])
      .mockResolvedValueOnce([{ perkId: 'perk1', _count: { id: 1 } }]);
    prisma.playerVenueVisitDay.findMany.mockResolvedValue([]);
    prisma.venueFeedEvent.findMany.mockResolvedValue([]);
    prisma.venueFunnelEvent.findMany.mockResolvedValue([]);
    prisma.venuePerk.findMany.mockResolvedValue([
      { id: 'perk1', title: 'Free coffee', code: 'COFFEE' },
    ]);
    prisma.proximityArrivalPushLog.count.mockResolvedValue(0);
    prisma.playerVenueGeofenceEvent.count.mockResolvedValue(0);
    prisma.playerVenuePolygonSession.findMany.mockResolvedValue([]);
  });

  it('returns issued and fulfilled redemption counts for a venue', async () => {
    const summary = await service.getVenueSummary('venue-1', { days: 30 });
    expect(summary.redemptions.issued).toBe(1);
    expect(summary.redemptions.fulfilled).toBe(2);
    expect(summary.redemptions.perPerk[0]).toMatchObject({
      perkId: 'perk1',
      issuedCount: 3,
      fulfilledCount: 1,
    });
  });
});
