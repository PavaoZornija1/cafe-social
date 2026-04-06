import { Injectable } from '@nestjs/common';
import { VenueFeedEventKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VenueFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async listForVenue(venueId: string, limit = 30) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { locked: true },
    });
    if (!venue) return [];
    if (venue.locked) return [];

    const take = Math.min(Math.max(limit, 1), 100);
    return this.prisma.venueFeedEvent.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        kind: true,
        title: true,
        subtitle: true,
        actorUsername: true,
        createdAt: true,
      },
    });
  }

  async recordWordMatchStarted(venueId: string, actorUsername: string, mode: 'coop' | 'versus') {
    await this.prisma.venueFeedEvent.create({
      data: {
        venueId,
        kind: VenueFeedEventKind.WORD_MATCH_STARTED,
        title: 'Word match started',
        subtitle: mode === 'coop' ? 'Co-op room' : 'Versus room',
        actorUsername,
      },
    });
  }

  async recordDailyWordSolved(venueId: string, actorUsername: string) {
    await this.prisma.venueFeedEvent.create({
      data: {
        venueId,
        kind: VenueFeedEventKind.DAILY_WORD_SOLVED,
        title: 'Daily word solved',
        subtitle: 'Venue puzzle',
        actorUsername,
      },
    });
  }
}
