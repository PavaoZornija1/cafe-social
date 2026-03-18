import { Injectable } from '@nestjs/common';
import type { PlayerVenue, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlayerVenueRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPlayerAndVenue(
    playerId: string,
    venueId: string,
  ): Promise<PlayerVenue | null> {
    return this.prisma.playerVenue.findUnique({
      where: {
        playerId_venueId: {
          playerId,
          venueId,
        },
      },
    });
  }

  create(data: Prisma.PlayerVenueCreateInput): Promise<PlayerVenue> {
    return this.prisma.playerVenue.create({ data });
  }
}

