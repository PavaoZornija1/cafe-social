import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayerVenueStatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async addVenueXp(playerId: string, venueId: string, delta: number): Promise<void> {
    if (delta === 0) return;
    await this.prisma.playerVenueStats.upsert({
      where: {
        playerId_venueId: { playerId, venueId },
      },
      create: { playerId, venueId, venueXp: Math.max(0, delta) },
      update: { venueXp: { increment: delta } },
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
