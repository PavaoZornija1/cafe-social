import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { BrawlerMatchQueueStatus, WordMatchQueueStatus } from '@prisma/client';
import { Interval } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { WordMatchService } from '../word/word-match.service';
import { BrawlerService } from '../brawler/brawler.service';
import { getQueueBotConfig } from './queue-bot-config';
import { WordMatchBotDriver } from './word-match-bot.driver';
import {
  QUEUE_BOT_WAITING_EVENT,
  QueueBotWaitingEvent,
} from './queue-bot.events';

type PendingFill = QueueBotWaitingEvent & {
  dueAt: number;
  failures: number;
  timer: ReturnType<typeof setTimeout>;
};

@Injectable()
export class QueueBotFillService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly log = new Logger(QueueBotFillService.name);
  private readonly pending = new Map<string, PendingFill>();
  private sweeping = false;
  private recovering = false;
  private destroyed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordMatch: WordMatchService,
    private readonly brawler: BrawlerService,
    private readonly wordBotDriver: WordMatchBotDriver,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.recoverWaitingEntries();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    for (const entry of this.pending.values()) clearTimeout(entry.timer);
    this.pending.clear();
  }

  @OnEvent(QUEUE_BOT_WAITING_EVENT)
  schedule(entry: QueueBotWaitingEvent): void {
    if (this.destroyed) return;
    const key = `${entry.game}:${entry.id}`;
    if (this.pending.has(key)) return;
    const cfg = getQueueBotConfig();
    const delay =
      entry.game === 'word' ? cfg.wordFillAfterMs : cfg.brawlerFillAfterMs;
    const dueAt = entry.createdAt.getTime() + delay;
    const timer = setTimeout(
      () => void this.sweep(),
      Math.max(0, dueAt - Date.now()),
    );
    timer.unref();
    this.pending.set(key, { ...entry, dueAt, timer, failures: 0 });
  }

  /** Only timers for known entries trigger work; an idle sweep never touches Prisma. */
  async sweep(): Promise<void> {
    if (this.sweeping || this.destroyed) return;
    const due = [...this.pending.entries()].filter(
      ([, entry]) => entry.dueAt <= Date.now(),
    );
    if (due.length === 0) return;
    this.sweeping = true;
    try {
      for (const [key, entry] of due) {
        try {
          if (entry.game === 'word') {
            const sessionId = await this.wordMatch.tryFillWordQueueWithBot(
              entry.id,
            );
            if (sessionId) await this.wordBotDriver.register(sessionId);
          } else {
            await this.brawler.tryFillBrawlerQueueWithBot(entry.id);
          }
          clearTimeout(entry.timer);
          this.pending.delete(key);
        } catch (e) {
          this.log.warn(`queue bot fill ${key}: ${(e as Error).message}`);
          clearTimeout(entry.timer);
          entry.failures += 1;
          if (entry.failures >= 3) {
            // Park until the five-minute recovery scan, rather than polling a broken entry.
            this.pending.delete(key);
            continue;
          }
          entry.dueAt = Date.now() + 5000 * 2 ** (entry.failures - 1);
          entry.timer = setTimeout(
            () => void this.sweep(),
            entry.dueAt - Date.now(),
          );
          entry.timer.unref();
        }
      }
    } finally {
      this.sweeping = false;
      // A new entry's timer may have fired while another fill was in flight.
      for (const entry of this.pending.values()) {
        if (entry.dueAt > Date.now()) continue;
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => void this.sweep(), 0);
        entry.timer.unref();
      }
    }
  }

  /** Restart/missed-event safety net, separate from the per-entry fill delay. */
  @Interval(5 * 60_000)
  async recoverWaitingEntries(): Promise<void> {
    if (this.recovering || this.destroyed) return;
    this.recovering = true;
    try {
      const word = await this.prisma.wordMatchQueueEntry.findMany({
        where: {
          status: WordMatchQueueStatus.WAITING,
          ranked: false,
          partyId: null,
        },
        select: { id: true, createdAt: true },
      });
      const brawler = await this.prisma.brawlerMatchQueueEntry.findMany({
        where: {
          status: BrawlerMatchQueueStatus.WAITING,
          ranked: false,
          partyId: null,
        },
        select: { id: true, createdAt: true },
      });
      for (const entry of word) this.schedule({ ...entry, game: 'word' });
      for (const entry of brawler) this.schedule({ ...entry, game: 'brawler' });
    } catch (e) {
      this.log.warn(`queue bot recovery: ${(e as Error).message}`);
    } finally {
      this.recovering = false;
    }
  }
}
