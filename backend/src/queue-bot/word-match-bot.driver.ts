import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GameSessionStatus, GameType } from '@prisma/client';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WordMatchService, type WordMatchConfig } from '../word/word-match.service';
import { getQueueBotConfig, jitterAround } from './queue-bot-config';

type BotState = {
  botParticipantId: string;
  mode: 'coop' | 'versus';
  difficulty: string;
  nextActionAt: number;
};

/** Advisory lock so only one process drives bot ticks in multi-instance deploys. */
const BOT_TICK_LOCK_K1 = 58_294_138;
const BOT_TICK_LOCK_K2 = 92_837_462;

/**
 * Drives queue-filled word bot opponents server-side (co-op passes / guesses; versus guesses).
 */
@Injectable()
export class WordMatchBotDriver implements OnModuleInit {
  private readonly log = new Logger(WordMatchBotDriver.name);
  private readonly pending = new Map<string, BotState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordMatch: WordMatchService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.rehydrateActiveSessions();
    } catch (e) {
      this.log.warn(`word bot rehydrate failed: ${(e as Error).message}`);
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
      include: { participants: true, wordSession: true },
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
    if (this.pending.has(sessionId)) return;

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
      qCfg.meanThinkMs[diff as keyof typeof qCfg.meanThinkMs] ?? qCfg.meanThinkMs.normal;

    this.pending.set(sessionId, {
      botParticipantId: bot.id,
      mode,
      difficulty: diff,
      nextActionAt: Date.now() + jitterAround(mean, qCfg.jitterPct),
    });
  }

  @Interval(1000)
  async tick(): Promise<void> {
    const acquired = await this.tryAcquireTickLock();
    if (!acquired) return;

    try {
      // Pick up sessions registered on another instance (or after restart) before pacing.
      await this.rehydrateActiveSessions();
      if (this.pending.size === 0) return;
      await this.tickLocked();
    } finally {
      await this.releaseTickLock();
    }
  }

  private async tickLocked(): Promise<void> {
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

  private async tryAcquireTickLock(): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
        'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS ok',
        BOT_TICK_LOCK_K1,
        BOT_TICK_LOCK_K2,
      );
      return Boolean(rows[0]?.ok);
    } catch {
      // Local/unit tests without raw SQL — allow tick to run.
      return true;
    }
  }

  private async releaseTickLock(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        'SELECT pg_advisory_unlock($1::integer, $2::integer)',
        BOT_TICK_LOCK_K1,
        BOT_TICK_LOCK_K2,
      );
    } catch {
      /* ignore */
    }
  }
}
