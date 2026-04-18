import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (venue.locked) throw new BadRequestException('Venue is not available');

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
        recordedAt: params.occurredAt ?? new Date(),
        clientDedupeKey: dedupe,
      },
    });
    return { id: row.id };
  }
}
