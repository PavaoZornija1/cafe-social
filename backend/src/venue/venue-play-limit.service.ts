import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { utcDayKey } from '../lib/day-key';
import { VenueService } from './venue.service';

const DEFAULT_DAILY_GAMES = 5;
const SOLO_REUSE_MS = 20 * 60 * 1000;

const TX_SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

@Injectable()
export class VenuePlayLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly venues: VenueService,
    private readonly config: ConfigService,
  ) {}

  dailyGameLimit(): number {
    const raw = this.config.get<string>('VENUE_GUEST_PLAY_DAILY_GAMES')?.trim();
    const n = raw != null && raw !== '' ? Number(raw) : DEFAULT_DAILY_GAMES;
    return Math.max(1, Number.isFinite(n) ? Math.floor(n) : DEFAULT_DAILY_GAMES);
  }

  private deny(): never {
    throw new ForbiddenException(
      `Daily venue game limit reached (${this.dailyGameLimit()} per UTC day). You can play again tomorrow.`,
    );
  }

  private async assertVenuePlayable(venueId: string): Promise<void> {
    const v = await this.venues.findOne(venueId);
    if (v.locked) {
      throw new ForbiddenException('This venue is temporarily unavailable');
    }
  }

  /** Solo: counts one game per venue per UTC day; rapid deck refetches within SOLO_REUSE_MS reuse the same slot. */
  async beginSoloWord(playerId: string, venueId: string): Promise<void> {
    await this.assertVenuePlayable(venueId);
    const limit = this.dailyGameLimit();
    const dayKey = utcDayKey();
    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        const day = await tx.playerVenuePlayDay.findUnique({
          where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
        });

        if (
          day?.lastSoloDeckAt != null &&
          now.getTime() - day.lastSoloDeckAt.getTime() < SOLO_REUSE_MS
        ) {
          return;
        }

        const used = day?.gamesPlayed ?? 0;
        if (used >= limit) this.deny();

        await tx.playerVenuePlayDay.upsert({
          where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
          create: {
            playerId,
            venueId,
            dayKey,
            gamesPlayed: 1,
            lastSoloDeckAt: now,
          },
          update: {
            gamesPlayed: { increment: 1 },
            lastSoloDeckAt: now,
          },
        });
      },
      TX_SERIALIZABLE,
    );
  }

  /** Match deck: one counted game per player per match session. */
  async beginWordMatchDeck(
    playerId: string,
    venueId: string,
    gameSessionId: string,
  ): Promise<void> {
    await this.assertVenuePlayable(venueId);
    const limit = this.dailyGameLimit();

    await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.playerVenuePlayCountedGame.findUnique({
          where: {
            playerId_gameSessionId_kind: {
              playerId,
              gameSessionId,
              kind: 'word_match',
            },
          },
        });
        if (existing) return;

        const dayKey = utcDayKey();
        const day = await tx.playerVenuePlayDay.findUnique({
          where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
        });
        const used = day?.gamesPlayed ?? 0;
        if (used >= limit) this.deny();

        await tx.playerVenuePlayCountedGame.create({
          data: {
            playerId,
            venueId,
            dayKey,
            kind: 'word_match',
            gameSessionId,
          },
        });

        await tx.playerVenuePlayDay.upsert({
          where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
          create: {
            playerId,
            venueId,
            dayKey,
            gamesPlayed: 1,
          },
          update: { gamesPlayed: { increment: 1 } },
        });
      },
      TX_SERIALIZABLE,
    );
  }

  /** Brawler arena start: one counted game per player per brawler session. */
  async beginBrawler(
    playerId: string,
    venueId: string,
    gameSessionId: string,
  ): Promise<void> {
    await this.assertVenuePlayable(venueId);
    const limit = this.dailyGameLimit();

    await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.playerVenuePlayCountedGame.findUnique({
          where: {
            playerId_gameSessionId_kind: {
              playerId,
              gameSessionId,
              kind: 'brawler',
            },
          },
        });
        if (existing) return;

        const dayKey = utcDayKey();
        const day = await tx.playerVenuePlayDay.findUnique({
          where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
        });
        const used = day?.gamesPlayed ?? 0;
        if (used >= limit) this.deny();

        await tx.playerVenuePlayCountedGame.create({
          data: {
            playerId,
            venueId,
            dayKey,
            kind: 'brawler',
            gameSessionId,
          },
        });

        await tx.playerVenuePlayDay.upsert({
          where: { playerId_venueId_dayKey: { playerId, venueId, dayKey } },
          create: {
            playerId,
            venueId,
            dayKey,
            gamesPlayed: 1,
          },
          update: { gamesPlayed: { increment: 1 } },
        });
      },
      TX_SERIALIZABLE,
    );
  }
}
