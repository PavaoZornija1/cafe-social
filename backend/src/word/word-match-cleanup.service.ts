import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GameSessionStatus, GameType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** PENDING word rooms older than this are cancelled so invite codes don't linger forever. */
const PENDING_WORD_MATCH_MAX_AGE_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class WordMatchCleanupService {
  private readonly log = new Logger(WordMatchCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expireStalePendingMatches(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_WORD_MATCH_MAX_AGE_MS);
    const res = await this.prisma.gameSession.updateMany({
      where: {
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
      this.log.log(`Cancelled ${res.count} stale PENDING word match(es)`);
    }
  }
}
