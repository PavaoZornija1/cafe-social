import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  ProximityArrivalService,
  VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
} from './proximity-arrival.service';
import { VenuePolygonSessionService } from './venue-polygon-session.service';

jest.mock('../venue/venue-offer-public.util', () => ({
  loadPublicVenueOffersForVenue: jest.fn(),
}));

import { loadPublicVenueOffersForVenue } from '../venue/venue-offer-public.util';

const loadOffers = loadPublicVenueOffersForVenue as jest.MockedFunction<
  typeof loadPublicVenueOffersForVenue
>;

describe('ProximityArrivalService', () => {
  let service: ProximityArrivalService;
  let prisma: {
    player: { findUnique: jest.Mock };
    venue: { findUnique: jest.Mock };
    proximityArrivalPushLog: {
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };
  let push: { sendToPlayers: jest.Mock };
  let configGet: jest.Mock;
  let polygonSessions: {
    hasOpenSession: jest.Mock;
    lastPolygonExitAt: jest.Mock;
  };

  const playerId = 'player-1';
  const venueId = 'venue-1';

  const basePlayer = {
    totalPrivacy: false,
    partnerMarketingPush: true,
    lastPresenceVenueId: 'other-venue',
  };

  const baseVenue = {
    id: venueId,
    name: 'Test Café',
    locked: false,
    proximityAlertsEnabled: true,
    proximityAlertRadiusMeters: 100,
  };

  beforeEach(async () => {
    prisma = {
      player: { findUnique: jest.fn() },
      venue: { findUnique: jest.fn() },
      proximityArrivalPushLog: {
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    push = { sendToPlayers: jest.fn().mockResolvedValue(undefined) };
    configGet = jest.fn().mockReturnValue(undefined);
    polygonSessions = {
      hasOpenSession: jest.fn().mockResolvedValue(false),
      lastPolygonExitAt: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProximityArrivalService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: VenuePolygonSessionService, useValue: polygonSessions },
      ],
    }).compile();

    service = moduleRef.get(ProximityArrivalService);
    loadOffers.mockReset();
  });

  async function runHappyPathSetup() {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.count.mockResolvedValue(0);
    prisma.proximityArrivalPushLog.findFirst.mockResolvedValue(null);
    loadOffers.mockResolvedValue({
      offers: [],
      featuredOffer: {
        id: 'offer-1',
        title: 'Free pastry',
        body: 'Show this push at the counter.',
        endsAt: null,
      },
    });
  }

  it('skips when PROXIMITY_ARRIVAL_PUSH_ENABLED=0', async () => {
    configGet.mockReturnValue('0');
    await service.trySendOnEnter({ playerId, venueId });
    expect(prisma.player.findUnique).not.toHaveBeenCalled();
  });

  it('skips when player has polygon presence at the venue', async () => {
    prisma.player.findUnique.mockResolvedValue({
      ...basePlayer,
      lastPresenceVenueId: venueId,
    });
    await service.trySendOnEnter({ playerId, venueId });
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();
  });

  it('skips when per-venue daily max is reached', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);

    await service.trySendOnEnter({ playerId, venueId });
    expect(loadOffers).not.toHaveBeenCalled();
  });

  it('skips when global daily max is reached', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);

    await service.trySendOnEnter({ playerId, venueId });
    expect(loadOffers).not.toHaveBeenCalled();
  });

  it('sends partner marketing push and logs on enter', async () => {
    await runHappyPathSetup();

    await service.trySendOnEnter({ playerId, venueId });

    expect(push.sendToPlayers).toHaveBeenCalledWith(
      [playerId],
      undefined,
      expect.objectContaining({
        title: 'Free pastry',
        data: expect.objectContaining({
          type: VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
          venueId,
        }),
      }),
      { channel: 'partner_marketing' },
    );

    expect(prisma.proximityArrivalPushLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerId,
        venueId,
        featuredOfferId: 'offer-1',
        proximityRadiusMeters: 100,
      }),
    });
  });

  it('does not log when push delivery fails', async () => {
    await runHappyPathSetup();
    push.sendToPlayers.mockRejectedValue(new Error('APNs down'));

    await service.trySendOnEnter({ playerId, venueId });

    expect(prisma.proximityArrivalPushLog.create).not.toHaveBeenCalled();
  });
});
