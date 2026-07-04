import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { ProximityArrivalService } from './proximity-arrival.service';
import { DiscoveryService } from './discovery.service';
import { GeofenceService } from './geofence.service';

describe('GeofenceService', () => {
  let service: GeofenceService;
  let prisma: {
    venue: { findUnique: jest.Mock };
    player: { findUnique: jest.Mock; update: jest.Mock };
    playerVenueGeofenceEvent: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    playerVenueVisitDay: { upsert: jest.Mock };
  };
  let proximityArrival: { trySendOnEnter: jest.Mock };
  let funnel: { safeLog: jest.Mock };
  let discovery: { trySendDueVenueOrderNudge: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venue: { findUnique: jest.fn() },
      player: { findUnique: jest.fn(), update: jest.fn() },
      playerVenueGeofenceEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      playerVenueVisitDay: { upsert: jest.fn() },
    };
    proximityArrival = { trySendOnEnter: jest.fn().mockResolvedValue(undefined) };
    funnel = { safeLog: jest.fn() };
    discovery = { trySendDueVenueOrderNudge: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeofenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProximityArrivalService, useValue: proximityArrival },
        { provide: VenueFunnelService, useValue: funnel },
        { provide: DiscoveryService, useValue: discovery },
      ],
    }).compile();

    service = moduleRef.get(GeofenceService);
  });

  const baseVenue = { id: 'venue-1', locked: false };

  it('rejects invalid kind', async () => {
    await expect(
      service.recordEvent({
        playerId: 'p1',
        venueId: 'venue-1',
        kind: 'ping' as 'enter',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when venue not found', async () => {
    prisma.venue.findUnique.mockResolvedValue(null);
    await expect(
      service.recordEvent({ playerId: 'p1', venueId: 'venue-1', kind: 'enter' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects locked venue', async () => {
    prisma.venue.findUnique.mockResolvedValue({ ...baseVenue, locked: true });
    await expect(
      service.recordEvent({ playerId: 'p1', venueId: 'venue-1', kind: 'enter' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns duplicate when client dedupe key already used', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.findUnique.mockResolvedValue({ id: 'evt-1' });

    const out = await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'enter',
      clientDedupeKey: 'dedupe-1',
    });

    expect(out).toEqual({ id: 'evt-1', duplicate: true });
    expect(prisma.playerVenueGeofenceEvent.create).not.toHaveBeenCalled();
    expect(proximityArrival.trySendOnEnter).not.toHaveBeenCalled();
  });

  it('records ring enter, visit day, starts dwell — does not set polygon presence', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.findUnique.mockResolvedValue(null);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-new' });
    prisma.player.findUnique.mockResolvedValue({
      lastPresenceVenueId: null,
      venueNudgeSessionVenueId: null,
      venueNudgeSessionStartedAt: null,
    });

    const out = await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'enter',
    });

    expect(out).toEqual({ id: 'evt-new' });
    expect(prisma.playerVenueGeofenceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        playerId: 'p1',
        venueId: 'venue-1',
        kind: 'enter',
        boundaryType: 'proximity_ring',
      }),
    });
    expect(proximityArrival.trySendOnEnter).toHaveBeenCalledWith({
      playerId: 'p1',
      venueId: 'venue-1',
    });
    expect(funnel.safeLog).toHaveBeenCalledWith({
      venueId: 'venue-1',
      playerId: 'p1',
      kind: 'proximity_ring_enter',
    });
    expect(prisma.playerVenueVisitDay.upsert).toHaveBeenCalled();
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        venueNudgeSessionVenueId: 'venue-1',
        venueNudgeSessionStartedAt: expect.any(Date),
      }),
    });
    expect(prisma.player.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastPresenceVenueId: expect.anything() }),
      }),
    );
    expect(discovery.trySendDueVenueOrderNudge).toHaveBeenCalledWith('p1');
  });

  it('does not restart dwell when polygon presence already at venue', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-new' });
    prisma.player.findUnique.mockResolvedValue({
      lastPresenceVenueId: 'venue-1',
      venueNudgeSessionVenueId: 'venue-1',
      venueNudgeSessionStartedAt: new Date(),
    });

    await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'enter',
    });

    expect(prisma.playerVenueVisitDay.upsert).toHaveBeenCalled();
    expect(prisma.player.update).not.toHaveBeenCalled();
  });

  it('records ring exit and clears ring dwell without clearing polygon presence', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-exit' });
    prisma.player.findUnique.mockResolvedValue({
      lastPresenceVenueId: null,
      venueNudgeSessionVenueId: 'venue-1',
    });

    await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'exit',
    });

    expect(proximityArrival.trySendOnEnter).not.toHaveBeenCalled();
    expect(funnel.safeLog).toHaveBeenCalledWith({
      venueId: 'venue-1',
      playerId: 'p1',
      kind: 'proximity_ring_exit',
    });
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        venueNudgeSessionVenueId: null,
        venueNudgeSessionStartedAt: null,
      },
    });
  });

  it('does not clear dwell on exit when polygon-present at venue', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-exit' });
    prisma.player.findUnique.mockResolvedValue({
      lastPresenceVenueId: 'venue-1',
      venueNudgeSessionVenueId: 'venue-1',
    });

    await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'exit',
    });

    expect(prisma.player.update).not.toHaveBeenCalled();
  });
});
