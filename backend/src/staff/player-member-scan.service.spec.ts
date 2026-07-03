jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
jest.mock('../venue/venue-offer.service', () => ({
  VenueOfferService: class VenueOfferService {},
}));
jest.mock('../challenge/challenge.service', () => ({
  ChallengeService: class ChallengeService {},
}));

import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildMemberCardQrPayload } from '../lib/member-card-qr';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from '../social/discovery.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { PlayerVenueCheckInRepository } from '../venue/player-venue-check-in.repository';
import { PlayerVenueRepository } from '../venue/player-venue.repository';
import { ChallengeService } from '../challenge/challenge.service';
import { VenueOfferService } from '../venue/venue-offer.service';
import { PlayerMemberScanService } from './player-member-scan.service';

const memberToken = 'abcdefghijklmnopqrstuv';

describe('PlayerMemberScanService', () => {
  let service: PlayerMemberScanService;
  let prisma: {
    venue: { findUnique: jest.Mock };
    player: { findUnique: jest.Mock };
    playerVenueVisitDay: { upsert: jest.Mock };
  };
  let moderation: { assertNotBanned: jest.Mock };
  let playerVenues: { findByPlayerAndVenue: jest.Mock; create: jest.Mock };
  let explicitCheckIns: { upsertCheckIn: jest.Mock };
  let funnel: { safeLog: jest.Mock };
  let discovery: { setPresence: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venue: { findUnique: jest.fn() },
      player: { findUnique: jest.fn() },
      playerVenueVisitDay: { upsert: jest.fn() },
    };
    moderation = { assertNotBanned: jest.fn().mockResolvedValue(undefined) };
    playerVenues = {
      findByPlayerAndVenue: jest.fn(),
      create: jest.fn(),
    };
    explicitCheckIns = { upsertCheckIn: jest.fn() };
    funnel = { safeLog: jest.fn() };
    discovery = { setPresence: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlayerMemberScanService,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueModerationService, useValue: moderation },
        { provide: PlayerVenueRepository, useValue: playerVenues },
        { provide: PlayerVenueCheckInRepository, useValue: explicitCheckIns },
        { provide: VenueFunnelService, useValue: funnel },
        { provide: DiscoveryService, useValue: discovery },
        {
          provide: ChallengeService,
          useValue: { bumpActiveChallengesForPlayerAtVenue: jest.fn() },
        },
        {
          provide: VenueOfferService,
          useValue: {
            listPendingMemberCardOffersForPlayer: jest.fn().mockResolvedValue([]),
            fulfillMemberCardOffer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(PlayerMemberScanService);
  });

  it('rejects unrecognized QR payload', async () => {
    await expect(
      service.scanMemberCardAtVenue({ venueId: 'v1', qrPayload: 'not-a-member-qr' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when member token is unknown', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      id: 'v1',
      locked: false,
      requiresExplicitCheckIn: false,
    });
    prisma.player.findUnique.mockResolvedValue(null);

    await expect(
      service.scanMemberCardAtVenue({
        venueId: 'v1',
        qrPayload: buildMemberCardQrPayload(memberToken),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records visit day, links venue, sets presence, logs funnel', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      id: 'v1',
      locked: false,
      requiresExplicitCheckIn: true,
    });
    prisma.player.findUnique.mockResolvedValue({
      id: 'p1',
      username: 'guest1',
    });
    playerVenues.findByPlayerAndVenue.mockResolvedValue(null);
    prisma.playerVenueVisitDay.upsert.mockResolvedValue({});

    const out = await service.scanMemberCardAtVenue({
      venueId: 'v1',
      qrPayload: buildMemberCardQrPayload(memberToken),
    });

    expect(moderation.assertNotBanned).toHaveBeenCalledWith('v1', 'p1');
    expect(prisma.playerVenueVisitDay.upsert).toHaveBeenCalled();
    expect(playerVenues.create).toHaveBeenCalled();
    expect(explicitCheckIns.upsertCheckIn).toHaveBeenCalledWith('p1', 'v1');
    expect(discovery.setPresence).toHaveBeenCalledWith('p1', 'v1');
    expect(funnel.safeLog).toHaveBeenCalledWith(
      expect.objectContaining({ venueId: 'v1', playerId: 'p1', kind: 'member_scan' }),
    );
    expect(out.playerId).toBe('p1');
    expect(out.username).toBe('guest1');
    expect(out.visitDayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('skips playerVenue create when link already exists', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      id: 'v1',
      locked: false,
      requiresExplicitCheckIn: false,
    });
    prisma.player.findUnique.mockResolvedValue({ id: 'p1', username: 'guest1' });
    playerVenues.findByPlayerAndVenue.mockResolvedValue({ id: 'pv1' });
    prisma.playerVenueVisitDay.upsert.mockResolvedValue({});

    await service.scanMemberCardAtVenue({
      venueId: 'v1',
      qrPayload: buildMemberCardQrPayload(memberToken),
    });

    expect(playerVenues.create).not.toHaveBeenCalled();
    expect(explicitCheckIns.upsertCheckIn).not.toHaveBeenCalled();
  });
});
