import { Injectable, Logger } from '@nestjs/common';
import {
  BrawlerMatchQueueStatus,
  WordMatchQueueStatus,
} from '@prisma/client';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WordMatchService } from '../word/word-match.service';
import { BrawlerService } from '../brawler/brawler.service';
import { getQueueBotConfig } from './queue-bot-config';
import { WordMatchBotDriver } from './word-match-bot.driver';

/** Stable advisory lock keys — queue bot sweep must be single-flight across processes. */
const ADV_LOCK_K1 = 58_294_137;
const ADV_LOCK_K2 = 92_837_461;

@Injectable()
export class QueueBotFillService {
  private readonly log = new Logger(QueueBotFillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordMatch: WordMatchService,
    private readonly brawler: BrawlerService,
    private readonly wordBotDriver: WordMatchBotDriver,
  ) {}

  @Interval(2000)
  async sweep(): Promise<void> {
    const acquired = await this.tryAcquireAdvisoryLock();
    if (!acquired) return;

    try {
      const cfg = getQueueBotConfig();
      await this.fillWordQueue(cfg.wordFillAfterMs);
      await this.fillBrawlerQueue(cfg.brawlerFillAfterMs);
      await this.brawler.expireStaleBrawlerQueueEntries();
    } catch (e) {
      this.log.warn(`queue bot sweep: ${(e as Error).message}`);
    } finally {
      await this.releaseAdvisoryLock();
    }
  }

  private async tryAcquireAdvisoryLock(): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
      'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS ok',
      ADV_LOCK_K1,
      ADV_LOCK_K2,
    );
    return Boolean(rows[0]?.ok);
  }

  private async releaseAdvisoryLock(): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      'SELECT pg_advisory_unlock($1::integer, $2::integer)',
      ADV_LOCK_K1,
      ADV_LOCK_K2,
    );
  }

  private async fillWordQueue(afterMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - afterMs);
    const rows = await this.prisma.wordMatchQueueEntry.findMany({
      where: {
        status: WordMatchQueueStatus.WAITING,
        ranked: false,
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
      select: { id: true },
    });

    for (const row of rows) {
      const sessionId = await this.wordMatch.tryFillWordQueueWithBot(row.id);
      if (sessionId) {
        await this.wordBotDriver.register(sessionId);
      }
    }
  }

  private async fillBrawlerQueue(afterMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - afterMs);
    const rows = await this.prisma.brawlerMatchQueueEntry.findMany({
      where: {
        status: BrawlerMatchQueueStatus.WAITING,
        ranked: false,
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
      select: { id: true },
    });

    for (const row of rows) {
      await this.brawler.tryFillBrawlerQueueWithBot(row.id);
    }
  }
}
