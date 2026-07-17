import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { activeVenueXpMultiplier } from '../venue/venue-offer-public.util';
import { VenueStaffService } from '../venue-staff/venue-staff.service';

@Injectable()
export class PlayerVenueStatsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venueStaff: VenueStaffService,
  ) {}

  async addVenueXp(playerId: string, venueId: string, delta: number): Promise<void> {
    if (delta === 0) return;
    // AUTO XP multipliers are guest rewards: staff at this venue keep base XP only.
    const isStaffHere = await this.venueStaff.isStaffAtVenue(playerId, venueId);
    const mult = isStaffHere ? 1 : await activeVenueXpMultiplier(this.prisma, venueId);
    const awarded =
      delta > 0 ? Math.max(1, Math.round(delta * mult)) : Math.round(delta * mult);
    await this.prisma.playerVenueStats.upsert({
      where: {
        playerId_venueId: { playerId, venueId },
      },
      create: { playerId, venueId, venueXp: Math.max(0, awarded) },
      update: { venueXp: { increment: awarded } },
    });
  }

  async sumVenueXpForPlayer(playerId: string): Promise<number> {
    const agg = await this.prisma.playerVenueStats.aggregate({
      where: { playerId },
      _sum: { venueXp: true },
    });
    return agg._sum.venueXp ?? 0;
  }
}
