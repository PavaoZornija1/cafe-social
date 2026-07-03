import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { GEOFENCE_BOUNDARY_PROXIMITY_RING } from './venue-attribution.config';
import { ProximityArrivalService } from './proximity-arrival.service';

@Injectable()
export class GeofenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proximityArrival: ProximityArrivalService,
    private readonly funnel: VenueFunnelService,
  ) {}

  async recordEvent(params: {
    playerId: string;
    venueId: string;
    kind: 'enter' | 'exit';
    occurredAt?: Date;
    clientDedupeKey?: string | null;
  }): Promise<{ id: string; duplicate?: boolean }> {
    const kind = params.kind;
    if (kind !== 'enter' && kind !== 'exit') {
      throw new BadRequestException('kind must be enter or exit');
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: params.venueId },
      select: { id: true, locked: true },
    });
    if (!venue) throw new NotFoundException('Venue not found');
    if (venue.locked) throw new NotFoundException('Venue not found');

    const dedupe = params.clientDedupeKey?.trim() || null;
    if (dedupe) {
      const existing = await this.prisma.playerVenueGeofenceEvent.findUnique({
        where: {
          playerId_clientDedupeKey: { playerId: params.playerId, clientDedupeKey: dedupe },
        },
      });
      if (existing) return { id: existing.id, duplicate: true };
    }

    const row = await this.prisma.playerVenueGeofenceEvent.create({
      data: {
        playerId: params.playerId,
        venueId: params.venueId,
        kind,
        boundaryType: GEOFENCE_BOUNDARY_PROXIMITY_RING,
        recordedAt: params.occurredAt ?? new Date(),
        clientDedupeKey: dedupe,
      },
    });

    if (kind === 'enter') {
      void this.proximityArrival.trySendOnEnter({
        playerId: params.playerId,
        venueId: params.venueId,
      });
      this.funnel.safeLog({
        venueId: params.venueId,
        playerId: params.playerId,
        kind: 'proximity_ring_enter',
      });
    } else {
      this.funnel.safeLog({
        venueId: params.venueId,
        playerId: params.playerId,
        kind: 'proximity_ring_exit',
      });
    }

    return { id: row.id };
  }
}
