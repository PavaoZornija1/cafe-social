import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { StripePartnerPpvBillingService } from '../stripe/stripe-partner-ppv-billing.service';
import { VenuePolygonSessionService } from './venue-polygon-session.service';

describe('VenuePolygonSessionService', () => {
  let service: VenuePolygonSessionService;
  let prisma: {
    playerVenuePolygonSession: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    proximityArrivalPushLog: { findFirst: jest.Mock };
  };
  let funnel: { safeLog: jest.Mock };

  const playerId = 'p1';
  const venueId = 'v1';

  beforeEach(async () => {
    prisma = {
      playerVenuePolygonSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      proximityArrivalPushLog: { findFirst: jest.fn() },
    };
    funnel = { safeLog: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        VenuePolygonSessionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: VenueFunnelService, useValue: funnel },
        { provide: StripePartnerPpvBillingService, useValue: { reportBillableVisit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(VenuePolygonSessionService);
  });

  it('opens a polygon session on enter', async () => {
    prisma.playerVenuePolygonSession.findFirst.mockResolvedValue(null);
    prisma.playerVenuePolygonSession.create.mockResolvedValue({ id: 'sess-1' });

    await service.onPolygonPresenceChange(playerId, null, venueId);

    expect(prisma.playerVenuePolygonSession.create).toHaveBeenCalled();
    expect(funnel.safeLog).toHaveBeenCalledWith({
      venueId,
      playerId,
      kind: 'polygon_enter',
    });
  });

  it('marks billable when nudge within window and dwell >= 15 min', async () => {
    const enteredAt = new Date(Date.now() - 20 * 60 * 1000);

    prisma.playerVenuePolygonSession.findFirst.mockResolvedValue({
      id: 'sess-1',
      enteredAt,
    });
    prisma.proximityArrivalPushLog.findFirst.mockResolvedValue({ id: 'nudge-1' });
    prisma.playerVenuePolygonSession.update.mockResolvedValue({});

    await service.onPolygonPresenceChange(playerId, venueId, null);

    expect(prisma.playerVenuePolygonSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: expect.objectContaining({
        dwellQualified: true,
        attributionMet: true,
        nudgeLogId: 'nudge-1',
        billableAt: expect.any(Date),
      }),
    });
    expect(funnel.safeLog).toHaveBeenCalledWith({
      venueId,
      playerId,
      kind: 'billable_visit',
    });
  });
});
