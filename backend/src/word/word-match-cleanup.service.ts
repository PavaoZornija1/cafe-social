import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameSessionStatus, GameType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WordMatchLiveRedisService } from './word-match-live-redis.service';

/** PENDING word rooms older than this are cancelled so invite codes don't linger forever. */
const PENDING_WORD_MATCH_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * ACTIVE word matches with no DB activity (updatedAt) past this idle TTL are cancelled.
 * Covers abandoned human matches and bot matches orphaned by process restart.
 */
const ACTIVE_WORD_MATCH_MAX_IDLE_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class WordMatchCleanupService {
  private readonly log = new Logger(WordMatchCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liveRedis: WordMatchLiveRedisService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expireStalePendingMatches(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_WORD_MATCH_MAX_AGE_MS);
    const stale = await this.prisma.gameSession.findMany({
      where: {
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });
    if (stale.length === 0) return;

    const res = await this.prisma.gameSession.updateMany({
      where: {
        id: { in: stale.map((r) => r.id) },
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      data: {
        status: GameSessionStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
    if (res.count > 0) {
      await this.liveRedis.removeSnapshots(stale.map((r) => r.id));
      this.log.log(`Cancelled ${res.count} stale PENDING word match(es)`);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expireStaleActiveMatches(): Promise<void> {
    const cutoff = new Date(Date.now() - ACTIVE_WORD_MATCH_MAX_IDLE_MS);
    const stale = await this.prisma.gameSession.findMany({
      where: {
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.ACTIVE,
        updatedAt: { lt: cutoff },
      },
      select: { id: true },
    });
    if (stale.length === 0) return;

    const res = await this.prisma.gameSession.updateMany({
      where: {
        id: { in: stale.map((r) => r.id) },
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.ACTIVE,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: GameSessionStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
    if (res.count > 0) {
      await this.liveRedis.removeSnapshots(stale.map((r) => r.id));
      this.log.log(`Cancelled ${res.count} stale ACTIVE word match(es)`);
    }
  }
}
