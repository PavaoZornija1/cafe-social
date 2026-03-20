import { Injectable } from '@nestjs/common';
import {
  GameSessionStatus,
  GameType,
  type BrawlerHero,
  type GameEventType,
  type GameParticipantResult,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SessionParticipantInput = {
  playerId?: string;
  isBot: boolean;
  botName?: string;
  brawlerHeroId?: string;
  characterSnapshot?: string;
  heroSnapshot?: Prisma.InputJsonValue;
};

@Injectable()
export class BrawlerRepository {
  constructor(private readonly prisma: PrismaService) { }

  findActiveHeroes(): Promise<BrawlerHero[]> {
    return this.prisma.brawlerHero.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findHeroesByIds(ids: string[]): Promise<BrawlerHero[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.prisma.brawlerHero.findMany({
      where: { id: { in: ids }, isActive: true },
    });
  }

  findPlayersByIds(ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.prisma.player.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }

  createSession(params: {
    venueId?: string;
    partyId?: string;
    participants: SessionParticipantInput[];
  }) {
    return this.prisma.gameSession.create({
      data: {
        gameType: GameType.BRAWLER,
        status: GameSessionStatus.PENDING,
        venueId: params.venueId,
        partyId: params.partyId,
        participants: {
          create: params.participants.map((p) => ({
            playerId: p.playerId,
            isBot: p.isBot,
            botName: p.botName,
            brawlerHeroId: p.brawlerHeroId,
            characterSnapshot: p.characterSnapshot,
            heroSnapshot: p.heroSnapshot,
          })),
        },
        brawlerSession: {
          create: {},
        },
      },
      include: {
        participants: true,
        brawlerSession: true,
      },
    });
  }

  findSessionById(sessionId: string) {
    return this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: true,
        brawlerSession: true,
      },
    });
  }

  startSession(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
      if (!session) return null;
      if (session.status !== GameSessionStatus.PENDING) return session;

      const updated = await tx.gameSession.update({
        where: { id: sessionId },
        data: {
          status: GameSessionStatus.ACTIVE,
          startedAt: new Date(),
        },
      });

      await tx.gameEvent.create({
        data: {
          sessionId,
          gameType: GameType.BRAWLER,
          eventType: 'SESSION_STARTED' as GameEventType,
          atMs: 0,
        },
      });

      return updated;
    });
  }

  createEvents(
    sessionId: string,
    events: Array<{
      atMs: number;
      eventType: GameEventType;
      actorParticipantId?: string;
      targetParticipantId?: string;
      payload?: Prisma.InputJsonValue;
    }>,
  ) {
    if (!events.length) return Promise.resolve({ count: 0 });
    return this.prisma.gameEvent.createMany({
      data: events.map((e) => ({
        sessionId,
        gameType: GameType.BRAWLER,
        eventType: e.eventType,
        atMs: e.atMs,
        actorParticipantId: e.actorParticipantId,
        targetParticipantId: e.targetParticipantId,
        payload: e.payload,
      })),
    });
  }

  finalizeSession(params: {
    sessionId: string;
    winnerParticipantId?: string;
    participants: Array<{
      participantId: string;
      placement?: number;
      score?: number;
      result?: GameParticipantResult;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      for (const p of params.participants) {
        await tx.gameParticipant.update({
          where: { id: p.participantId },
          data: {
            placement: p.placement,
            score: p.score,
            result: p.result,
          },
        });
      }

      const session = await tx.gameSession.update({
        where: { id: params.sessionId },
        data: {
          status: GameSessionStatus.FINISHED,
          endedAt: now,
          winnerParticipantId: params.winnerParticipantId,
        },
        include: {
          participants: true,
        },
      });

      const playerParticipants = session.participants.filter((p) => !!p.playerId);
      for (const p of playerParticipants) {
        const result = p.result;
        await tx.playerGameStats.upsert({
          where: {
            playerId_gameType: {
              playerId: p.playerId!,
              gameType: GameType.BRAWLER,
            },
          },
          create: {
            playerId: p.playerId!,
            gameType: GameType.BRAWLER,
            matchesPlayed: 1,
            wins: result === 'WIN' ? 1 : 0,
            losses: result === 'LOSS' ? 1 : 0,
            draws: result === 'DRAW' ? 1 : 0,
            totalKills: p.kills,
            totalDeaths: p.deaths,
            totalAssists: p.assists,
            totalScore: p.score,
            bestPlacement: p.placement ?? null,
            winRate: result === 'WIN' ? 1 : 0,
            firstPlayedAt: now,
            lastPlayedAt: now,
          },
          update: {
            matchesPlayed: { increment: 1 },
            wins: result === 'WIN' ? { increment: 1 } : undefined,
            losses: result === 'LOSS' ? { increment: 1 } : undefined,
            draws: result === 'DRAW' ? { increment: 1 } : undefined,
            totalKills: { increment: p.kills },
            totalDeaths: { increment: p.deaths },
            totalAssists: { increment: p.assists },
            totalScore: { increment: p.score },
            lastPlayedAt: now,
          },
        });
      }

      await tx.gameEvent.create({
        data: {
          sessionId: params.sessionId,
          gameType: GameType.BRAWLER,
          eventType: 'SESSION_ENDED' as GameEventType,
          atMs: 0,
          payload: {
            winnerParticipantId: params.winnerParticipantId ?? null,
          },
        },
      });

      return session;
    });
  }
}

