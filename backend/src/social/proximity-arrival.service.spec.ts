import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  ProximityArrivalService,
  VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
} from './proximity-arrival.service';

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
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
  };
  let push: { sendToPlayers: jest.Mock };
  let configGet: jest.Mock;

  const playerId = 'player-1';
  const venueId = 'venue-1';

  const basePlayer = {
    totalPrivacy: false,
    partnerMarketingPush: true,
    lastPresenceVenueId: 'other-venue',
    lastPresenceAt: new Date(),
  };

  const baseVenue = {
    id: venueId,
    name: 'Test Café',
    locked: false,
    latitude: 45.8,
    longitude: 15.9,
    geofencePolygon: {},
    proximityAlertsEnabled: true,
    proximityAlertRadiusMeters: 100,
  };

  beforeEach(async () => {
    prisma = {
      player: { findUnique: jest.fn() },
      venue: { findUnique: jest.fn() },
      proximityArrivalPushLog: {
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    push = { sendToPlayers: jest.fn().mockResolvedValue(undefined) };
    configGet = jest.fn().mockReturnValue(undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProximityArrivalService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = moduleRef.get(ProximityArrivalService);
    loadOffers.mockReset();
  });

  async function runHappyPathSetup() {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.findUnique.mockResolvedValue(null);
    prisma.proximityArrivalPushLog.count.mockResolvedValue(0);
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

  it('skips when player has total privacy or marketing opt-out', async () => {
    prisma.player.findUnique.mockResolvedValue({
      ...basePlayer,
      totalPrivacy: true,
    });
    await service.trySendOnEnter({ playerId, venueId });
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();

    prisma.player.findUnique.mockResolvedValue({
      ...basePlayer,
      partnerMarketingPush: false,
    });
    await service.trySendOnEnter({ playerId, venueId });
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();
  });

  it('skips when player is already at the venue', async () => {
    prisma.player.findUnique.mockResolvedValue({
      ...basePlayer,
      lastPresenceVenueId: venueId,
    });
    await service.trySendOnEnter({ playerId, venueId });
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();
  });

  it('skips when venue is locked or proximity alerts disabled', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);

    prisma.venue.findUnique.mockResolvedValue({ ...baseVenue, locked: true });
    await service.trySendOnEnter({ playerId, venueId });
    expect(loadOffers).not.toHaveBeenCalled();

    prisma.venue.findUnique.mockResolvedValue({
      ...baseVenue,
      proximityAlertsEnabled: false,
    });
    await service.trySendOnEnter({ playerId, venueId });
    expect(loadOffers).not.toHaveBeenCalled();
  });

  it('skips when already sent for this venue today', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.findUnique.mockResolvedValue({ id: 'log-1' });

    await service.trySendOnEnter({ playerId, venueId });
    expect(loadOffers).not.toHaveBeenCalled();
  });

  it('skips when global daily cap (2) is reached', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.findUnique.mockResolvedValue(null);
    prisma.proximityArrivalPushLog.count.mockResolvedValue(2);

    await service.trySendOnEnter({ playerId, venueId });
    expect(loadOffers).not.toHaveBeenCalled();
  });

  it('skips when venue has no featured offer copy', async () => {
    prisma.player.findUnique.mockResolvedValue(basePlayer);
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.proximityArrivalPushLog.findUnique.mockResolvedValue(null);
    prisma.proximityArrivalPushLog.count.mockResolvedValue(0);
    loadOffers.mockResolvedValue({ offers: [], featuredOffer: null });

    await service.trySendOnEnter({ playerId, venueId });
    expect(push.sendToPlayers).not.toHaveBeenCalled();
  });

  it('sends partner marketing push and logs on enter', async () => {
    await runHappyPathSetup();

    await service.trySendOnEnter({ playerId, venueId });

    expect(push.sendToPlayers).toHaveBeenCalledWith(
      [playerId],
      undefined,
      expect.objectContaining({
        title: 'Free pastry',
        body: 'Show this push at the counter.',
        data: expect.objectContaining({
          type: VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
          pushCategory: 'partner_marketing',
          venueId,
          venueName: 'Test Café',
          featuredOfferId: 'offer-1',
        }),
      }),
      { channel: 'partner_marketing' },
    );

    expect(prisma.proximityArrivalPushLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ playerId, venueId }),
    });
  });

  it('does not log when push delivery fails', async () => {
    await runHappyPathSetup();
    push.sendToPlayers.mockRejectedValue(new Error('APNs down'));

    await service.trySendOnEnter({ playerId, venueId });

    expect(prisma.proximityArrivalPushLog.create).not.toHaveBeenCalled();
  });
});
