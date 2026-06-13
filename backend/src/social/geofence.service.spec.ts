import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryService } from './discovery.service';
import { ProximityArrivalService } from './proximity-arrival.service';
import { GeofenceService } from './geofence.service';

describe('GeofenceService', () => {
  let service: GeofenceService;
  let prisma: {
    venue: { findUnique: jest.Mock };
    playerVenueGeofenceEvent: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    player: { findUnique: jest.Mock };
  };
  let proximityArrival: { trySendOnEnter: jest.Mock };
  let discovery: { setPresence: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venue: { findUnique: jest.fn() },
      playerVenueGeofenceEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      player: { findUnique: jest.fn() },
    };
    proximityArrival = { trySendOnEnter: jest.fn().mockResolvedValue(undefined) };
    discovery = { setPresence: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GeofenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProximityArrivalService, useValue: proximityArrival },
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
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('records enter and triggers proximity arrival push', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.findUnique.mockResolvedValue(null);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-new' });

    const out = await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'enter',
    });

    expect(out).toEqual({ id: 'evt-new' });
    expect(proximityArrival.trySendOnEnter).toHaveBeenCalledWith({
      playerId: 'p1',
      venueId: 'venue-1',
    });
    expect(discovery.setPresence).toHaveBeenCalledWith('p1', 'venue-1');
  });

  it('records exit without proximity arrival push', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-exit' });
    prisma.player.findUnique.mockResolvedValue({ lastPresenceVenueId: 'venue-1' });

    await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'exit',
    });

    expect(proximityArrival.trySendOnEnter).not.toHaveBeenCalled();
    expect(discovery.setPresence).toHaveBeenCalledWith('p1', null);
  });

  it('exit does not clear presence when player moved to another venue', async () => {
    prisma.venue.findUnique.mockResolvedValue(baseVenue);
    prisma.playerVenueGeofenceEvent.create.mockResolvedValue({ id: 'evt-exit' });
    prisma.player.findUnique.mockResolvedValue({ lastPresenceVenueId: 'venue-2' });

    await service.recordEvent({
      playerId: 'p1',
      venueId: 'venue-1',
      kind: 'exit',
    });

    expect(discovery.setPresence).not.toHaveBeenCalled();
  });
});
