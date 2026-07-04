import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { GEOFENCE_BOUNDARY_PROXIMITY_RING } from './venue-attribution.config';
import { ProximityArrivalService } from './proximity-arrival.service';
import { DiscoveryService } from './discovery.service';
import { utcDayKey } from '../lib/day-key';

@Injectable()
export class GeofenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proximityArrival: ProximityArrivalService,
    private readonly funnel: VenueFunnelService,
    private readonly discovery: DiscoveryService,
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

    const recordedAt = params.occurredAt ?? new Date();
    const row = await this.prisma.playerVenueGeofenceEvent.create({
      data: {
        playerId: params.playerId,
        venueId: params.venueId,
        kind,
        boundaryType: GEOFENCE_BOUNDARY_PROXIMITY_RING,
        recordedAt,
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
      await this.applyRingEnterDwell(params.playerId, params.venueId, recordedAt);
    } else {
      this.funnel.safeLog({
        venueId: params.venueId,
        playerId: params.playerId,
        kind: 'proximity_ring_exit',
      });
      await this.applyRingExitDwell(params.playerId, params.venueId);
    }

    return { id: row.id };
  }

  /**
   * Ring enter (app may be killed): visit day + start order-nudge dwell clock.
   * Does **not** set polygon presence / play geofence sessions — those stay client GPS only.
   */
  private async applyRingEnterDwell(
    playerId: string,
    venueId: string,
    at: Date,
  ): Promise<void> {
    const dayKey = utcDayKey(at);
    await this.prisma.playerVenueVisitDay.upsert({
      where: {
        playerId_venueId_dayKey: { playerId, venueId, dayKey },
      },
      create: { playerId, venueId, dayKey },
      update: {},
    });

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        lastPresenceVenueId: true,
        venueNudgeSessionVenueId: true,
        venueNudgeSessionStartedAt: true,
      },
    });
    if (!player) return;

    // Polygon presence already owns the dwell clock for this venue.
    if (player.lastPresenceVenueId === venueId) return;

    if (
      player.venueNudgeSessionVenueId === venueId &&
      player.venueNudgeSessionStartedAt
    ) {
      void this.discovery.trySendDueVenueOrderNudge(playerId);
      return;
    }

    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        venueNudgeSessionVenueId: venueId,
        venueNudgeSessionStartedAt: at,
      },
    });
    void this.discovery.trySendDueVenueOrderNudge(playerId);
  }

  /**
   * Ring exit: end ring-started dwell when the player is not polygon-present.
   * Leaves polygon presence alone (authoritative play geofence stays client-driven).
   */
  private async applyRingExitDwell(playerId: string, venueId: string): Promise<void> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        lastPresenceVenueId: true,
        venueNudgeSessionVenueId: true,
      },
    });
    if (!player) return;
    if (player.lastPresenceVenueId === venueId) return;
    if (player.venueNudgeSessionVenueId !== venueId) return;

    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        venueNudgeSessionVenueId: null,
        venueNudgeSessionStartedAt: null,
      },
    });
  }
}
