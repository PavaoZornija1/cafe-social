import { Injectable, Logger } from '@nestjs/common';
import { GameSessionStatus } from '@prisma/client';
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

/**
 * Drives queue-filled word bot opponents server-side (co-op passes / guesses; versus guesses).
 */
@Injectable()
export class WordMatchBotDriver {
  private readonly log = new Logger(WordMatchBotDriver.name);
  private readonly pending = new Map<string, BotState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wordMatch: WordMatchService,
  ) {}

  /** Start pacing bot actions after the session is ACTIVE. */
  async register(sessionId: string): Promise<void> {
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
}
