import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Recent QR check-ins count as valid for venue-gated features. */
export const EXPLICIT_CHECK_IN_VALID_HOURS = 24;

@Injectable()
export class PlayerVenueCheckInRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertCheckIn(playerId: string, venueId: string): Promise<void> {
    const now = new Date();
    await this.prisma.playerVenueCheckIn.upsert({
      where: {
        playerId_venueId: { playerId, venueId },
      },
      create: { playerId, venueId, lastCheckInAt: now },
      update: { lastCheckInAt: now },
    });
  }

  async hasRecentCheckIn(
    playerId: string,
    venueId: string,
    validHours: number = EXPLICIT_CHECK_IN_VALID_HOURS,
  ): Promise<boolean> {
    const row = await this.prisma.playerVenueCheckIn.findUnique({
      where: { playerId_venueId: { playerId, venueId } },
    });
    if (!row) return false;
    const ms = validHours * 60 * 60 * 1000;
    return row.lastCheckInAt.getTime() > Date.now() - ms;
  }
}
