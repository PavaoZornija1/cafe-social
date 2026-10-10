import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { GameSessionStatus, GameType } from '@prisma/client';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  WordMatchService,
  type WordMatchConfig,
} from '../word/word-match.service';
import { getQueueBotConfig, jitterAround } from './queue-bot-config';
import { QueueBotLockBusyError } from './queue-bot-lock';

type BotState = {
  botParticipantId: string;
  mode: 'coop' | 'versus';
  difficulty: string;
  nextActionAt: number;
};

/**
 * Drives queue-filled word bot opponents server-side (co-op passes / guesses; versus guesses).
 */
@Injectable()
export class WordMatchBotDriver implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(WordMatchBotDriver.name);
  private readonly pending = new Map<string, BotState>();
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  private recovering = false;
  private destroyed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordMatch: WordMatchService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverActiveSessions();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.pending.clear();
  }

  @Interval(5 * 60_000)
  async recoverActiveSessions(): Promise<void> {
    if (this.recovering || this.destroyed) return;
    this.recovering = true;
    try {
      await this.rehydrateActiveSessions();
    } catch (e) {
      this.log.warn(`word bot rehydrate failed: ${(e as Error).message}`);
    } finally {
      this.recovering = false;
    }
  }

  /** Test/introspection helper — session ids currently paced by this process. */
  pendingSessionIds(): string[] {
    return [...this.pending.keys()];
  }

  /**
   * After process restart, restore drivers for ACTIVE WORD_GAME sessions that still have a live bot.
   */
  async rehydrateActiveSessions(): Promise<void> {
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.ACTIVE,
        participants: { some: { isBot: true, leftAt: null } },
      },
      select: { id: true },
    });
    let n = 0;
    for (const session of sessions) {
      await this.register(session.id);
      if (this.pending.has(session.id)) n += 1;
    }
    if (n > 0) {
      this.log.log(`Rehydrated ${n} word bot driver(s) from ACTIVE sessions`);
    }
  }

  /** Start pacing bot actions after the session is ACTIVE. */
  async register(sessionId: string): Promise<void> {
    if (this.destroyed || this.pending.has(sessionId)) return;

    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true, wordSession: true },
    });
    if (!session || session.status !== GameSessionStatus.ACTIVE) return;

    const bot = session.participants.find((p) => p.isBot && !p.leftAt);
    if (!bot) return;

    const cfgJson = session.config as unknown as WordMatchConfig;
    const mode = cfgJson.wordGameMode;
    if (mode !== 'coop' && mode !== 'versus') return;

    const qCfg = getQueueBotConfig();
    const diff = cfgJson.difficulty ?? 'normal';
    const mean =
      qCfg.meanThinkMs[diff as keyof typeof qCfg.meanThinkMs] ??
      qCfg.meanThinkMs.normal;

    if (this.destroyed || this.pending.has(sessionId)) return;
    const thinkMs = jitterAround(mean, qCfg.jitterPct);
    this.pending.set(sessionId, {
      botParticipantId: bot.id,
      mode,
      difficulty: diff,
      nextActionAt: Date.now() + thinkMs,
    });
    this.startTimer();
  }

  private startTimer(): void {
    if (this.timer || this.destroyed) return;
    this.timer = setInterval(
      () => void this.tick(),
      getQueueBotConfig().wordBotTickMs,
    );
    this.timer.unref();
  }

  async tick(): Promise<void> {
    if (this.ticking || this.destroyed || this.pending.size === 0) return;
    if (
      ![...this.pending.values()].some(
        (state) => state.nextActionAt <= Date.now(),
      )
    )
      return;
    this.ticking = true;
    try {
      await this.tickSessions();
    } catch (e) {
      this.log.warn(`word bot tick failed: ${(e as Error).message}`);
    } finally {
      this.ticking = false;
      if (this.pending.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    }
  }

  private async tickSessions(): Promise<void> {
    const now = Date.now();
    const qCfg = getQueueBotConfig();

    for (const [sessionId, state] of [...this.pending.entries()]) {
      if (now < state.nextActionAt) continue;

      const alive = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });
      if (!alive || alive.status !== GameSessionStatus.ACTIVE) {
        this.pending.delete(sessionId);
        continue;
      }

      const rate =
        qCfg.correctRate[state.difficulty as keyof typeof qCfg.correctRate] ??
        qCfg.correctRate.normal;
      const mean =
        qCfg.meanThinkMs[state.difficulty as keyof typeof qCfg.meanThinkMs] ??
        qCfg.meanThinkMs.normal;

      try {
        if (state.mode === 'coop') {
          const roll = Math.random();
          if (roll < rate) {
            await this.wordMatch.executeWordMatchBotCoopTurn(
              sessionId,
              state.botParticipantId,
              'correct',
            );
          } else {
            await this.wordMatch.executeWordMatchBotCoopTurn(
              sessionId,
              state.botParticipantId,
              'pass',
            );
          }
        } else {
          const roll = Math.random();
          if (roll < rate) {
            await this.wordMatch.executeWordMatchBotVersusTurn(
              sessionId,
              state.botParticipantId,
              'correct',
            );
          } else {
            await this.wordMatch.executeWordMatchBotVersusTurn(
              sessionId,
              state.botParticipantId,
              'wrong',
            );
          }
        }
      } catch (e) {
        this.log.debug(`word bot tick ${sessionId}: ${(e as Error).message}`);
        if (e instanceof QueueBotLockBusyError) {
          state.nextActionAt = Date.now() + 5000;
          continue;
        }
        this.pending.delete(sessionId);
        continue;
      }

      const still = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });
      if (!still || still.status !== GameSessionStatus.ACTIVE) {
        this.pending.delete(sessionId);
        continue;
      }

      state.nextActionAt = Date.now() + jitterAround(mean, qCfg.jitterPct);
    }
  }
}
