import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BrawlerMatchQueueStatus,
  GameSessionStatus,
  GameType,
  type GameEventType,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { VenueService } from '../venue/venue.service';
import { BrawlerRepository } from './brawler.repository';
import { GameXpAwardService } from '../stats/game-xp-award.service';
import {
  CreateBrawlerSessionDto,
  type CreateBrawlerParticipantDto,
} from './dto/create-brawler-session.dto';
import { RecordBrawlerEventsDto } from './dto/record-brawler-events.dto';
import { FinalizeBrawlerSessionDto } from './dto/finalize-brawler-session.dto';
import type { EnqueueBrawlerMatchQueueDto } from './dto/enqueue-brawler-match-queue.dto';
import { BrawlerLiveRedisService } from './brawler-live-redis.service';
import { resolveIfSnapshotRev } from '../game-runtime/snapshot-rev.util';

type BrawlerSessionView = NonNullable<Awaited<ReturnType<BrawlerRepository['findSessionById']>>>;

export type BrawlerSessionPayload = BrawlerSessionView & { snapshotRev: number | null };

@Injectable()
export class BrawlerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brawlerRepo: BrawlerRepository,
    private readonly players: PlayerService,
    private readonly venuePlayLimit: VenuePlayLimitService,
    private readonly venues: VenueService,
    private readonly gameXp: GameXpAwardService,
    private readonly brawlerLive: BrawlerLiveRedisService,
  ) {}

  private async syncBrawlerSnapshot(sessionId: string): Promise<void> {
    await this.brawlerLive.refreshSnapshot(sessionId);
  }

  private async readBrawlerSnapshotRev(sessionId: string): Promise<number | null> {
    const env = await this.brawlerLive.readSession(sessionId);
    return env?.rev ?? null;
  }

  private async assertBrawlerIfSnapshotRev(
    sessionId: string,
    expected: number | undefined,
  ): Promise<void> {
    if (expected === undefined) return;
    const env = await this.brawlerLive.readSession(sessionId);
    if (!env) return;
    if (env.rev !== expected) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'snapshot revision mismatch',
        currentRev: env.rev,
      });
    }
  }

  private async assertAtVenueIfNeeded(
    sessionVenueId: string | null | undefined,
    latitude?: number,
    longitude?: number,
  ): Promise<void> {
    if (!sessionVenueId) return;
    const hasCoords =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);
    if (!hasCoords) {
      throw new ForbiddenException('Venue brawler play requires your current location (lat/lng)');
    }
    await this.venues.assertCoordinatesAllowedForGuestVenue(
      sessionVenueId,
      latitude!,
      longitude!,
    );
  }

  listHeroes() {
    return this.brawlerRepo.findActiveHeroes();
  }

  async createSession(email: string, dto: CreateBrawlerSessionDto) {
    const requester = await this.players.findOrCreateByEmail(email);
    const participants = dto.participants.map((p) => {
      if (!p.isBot && !p.playerId) {
        return { ...p, playerId: requester.id };
      }
      return p;
    });

    if (!participants.some((p) => p.playerId === requester.id)) {
      participants.push({
        playerId: requester.id,
        isBot: false,
      });
    }

    if (participants.length < 2 || participants.length > 4) {
      throw new BadRequestException('participants must be between 2 and 4');
    }

    this.validateParticipants(participants);

    const rankedReq = Boolean(dto.ranked);
    const humanCount = participants.filter((p) => !p.isBot && p.playerId).length;
    const hasBot = participants.some((p) => p.isBot);

    if (rankedReq) {
      if (hasBot) {
        throw new BadRequestException('ranked brawler cannot include bots');
      }
      if (participants.length !== 2 || humanCount !== 2) {
        throw new BadRequestException('ranked brawler requires exactly two human participants');
      }
      if (!dto.venueId) {
        throw new BadRequestException('ranked brawler requires a venue');
      }
      if (!participants.every((p) => p.brawlerHeroId)) {
        throw new BadRequestException('ranked brawler requires each participant to pick a hero');
      }
      await this.assertAtVenueIfNeeded(dto.venueId, dto.latitude, dto.longitude);
    }

    const playerIds = [...new Set(participants.map((p) => p.playerId).filter(Boolean))] as string[];
    const foundPlayers = await this.brawlerRepo.findPlayersByIds(playerIds);
    if (foundPlayers.length !== playerIds.length) {
      throw new BadRequestException('one or more players were not found');
    }

    const heroIds = [
      ...new Set(participants.map((p) => p.brawlerHeroId).filter(Boolean)),
    ] as string[];
    const heroes = await this.brawlerRepo.findHeroesByIds(heroIds);
    if (heroes.length !== heroIds.length) {
      throw new BadRequestException('one or more brawlerHeroId values are invalid');
    }
    const heroById = new Map(heroes.map((h) => [h.id, h]));

    const config: Prisma.InputJsonValue | undefined =
      !hasBot && humanCount === 2
        ? ({ ranked: rankedReq } as Prisma.InputJsonValue)
        : undefined;

    const created = await this.brawlerRepo.createSession({
      venueId: dto.venueId,
      partyId: dto.partyId,
      config,
      participants: participants.map((p) => {
        const hero = p.brawlerHeroId ? heroById.get(p.brawlerHeroId) : null;
        return {
          playerId: p.playerId,
          isBot: p.isBot,
          botName: p.botName,
          brawlerHeroId: p.brawlerHeroId,
          characterSnapshot: p.brawlerHeroId ?? p.botName,
          heroSnapshot: hero
            ? {
                id: hero.id,
                name: hero.name,
                version: hero.version,
                baseHp: hero.baseHp,
                moveSpeed: hero.moveSpeed,
                dashCooldownMs: hero.dashCooldownMs,
                attackDamage: hero.attackDamage,
                attackKnockback: hero.attackKnockback,
              }
            : undefined,
        };
      }),
    });
    await this.syncBrawlerSnapshot(created.id);
    return {
      ...created,
      snapshotRev: await this.readBrawlerSnapshotRev(created.id),
    };
  }

  async getSession(sessionId: string): Promise<BrawlerSessionPayload> {
    const env = await this.brawlerLive.readSession(sessionId);
    if (env?.session) {
      return { ...(env.session as BrawlerSessionView), snapshotRev: env.rev };
    }
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session) throw new NotFoundException('session not found');
    await this.syncBrawlerSnapshot(sessionId);
    return {
      ...session,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  async startSession(sessionId: string, email: string, ifSnapshotRev?: number) {
    await this.assertBrawlerIfSnapshotRev(sessionId, ifSnapshotRev);
    const session = await this.brawlerRepo.startSession(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not pending');
    }
    if (session.venueId) {
      const full = await this.brawlerRepo.findSessionById(sessionId);
      if (full) {
        const player = await this.players.findOrCreateByEmail(email);
        const human = full.participants.find((p) => p.playerId === player.id && !p.isBot);
        if (human) {
          await this.venuePlayLimit.beginBrawler(player.id, session.venueId, sessionId);
        }
      }
    }
    await this.syncBrawlerSnapshot(sessionId);
    return {
      ...session,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  async abandonSession(sessionId: string, email: string, ifSnapshotRev?: number) {
    await this.assertBrawlerIfSnapshotRev(sessionId, ifSnapshotRev);
    const existing = await this.brawlerRepo.findSessionById(sessionId);
    if (!existing) throw new NotFoundException('session not found');
    if (existing.gameType !== GameType.BRAWLER) {
      throw new BadRequestException('not a brawler session');
    }
    if (
      existing.status !== GameSessionStatus.PENDING &&
      existing.status !== GameSessionStatus.ACTIVE
    ) {
      throw new BadRequestException('session cannot be abandoned');
    }
    const player = await this.players.findOrCreateByEmail(email);
    const isParticipant = existing.participants.some(
      (p) => p.playerId === player.id && !p.leftAt,
    );
    if (!isParticipant) throw new ForbiddenException('not in this session');

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: GameSessionStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
    await this.syncBrawlerSnapshot(sessionId);
    return {
      ok: true as const,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  async recordEvents(sessionId: string, dto: RecordBrawlerEventsDto, ifMatchHeader?: string) {
    await this.assertBrawlerIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not active');
    }

    const participantIds = new Set(session.participants.map((p) => p.id));
    for (const event of dto.events) {
      if (event.actorParticipantId && !participantIds.has(event.actorParticipantId)) {
        throw new BadRequestException('actorParticipantId is not in this session');
      }
      if (event.targetParticipantId && !participantIds.has(event.targetParticipantId)) {
        throw new BadRequestException('targetParticipantId is not in this session');
      }
    }

    const created = await this.brawlerRepo.createEvents(
      sessionId,
      dto.events.map((e) => ({
        atMs: e.atMs,
        eventType: e.eventType as GameEventType,
        actorParticipantId: e.actorParticipantId,
        targetParticipantId: e.targetParticipantId,
        payload: e.payload as Prisma.InputJsonValue | undefined,
      })),
    );

    await this.syncBrawlerSnapshot(sessionId);
    return {
      inserted: created.count,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  async finalizeSession(sessionId: string, dto: FinalizeBrawlerSessionDto, ifMatchHeader?: string) {
    await this.assertBrawlerIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const existingSession = await this.brawlerRepo.findSessionById(sessionId);
    if (!existingSession) throw new NotFoundException('session not found');
    if (existingSession.status === GameSessionStatus.FINISHED) {
      throw new BadRequestException('session already finished');
    }
    if (existingSession.status === GameSessionStatus.CANCELLED) {
      throw new BadRequestException('session was cancelled');
    }

    const participantIds = new Set(existingSession.participants.map((p) => p.id));
    for (const p of dto.participants) {
      if (!participantIds.has(p.participantId)) {
        throw new BadRequestException('participantId is not in this session');
      }
    }
    if (dto.winnerParticipantId && !participantIds.has(dto.winnerParticipantId)) {
      throw new BadRequestException('winnerParticipantId is not in this session');
    }

    const session = await this.brawlerRepo.finalizeSession({
      sessionId,
      winnerParticipantId: dto.winnerParticipantId,
      participants: dto.participants,
    });
    void this.gameXp.tryAwardSessionWinXp(sessionId);
    await this.syncBrawlerSnapshot(sessionId);
    return {
      ...session,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  async enqueueVenueBrawlerMatch(email: string, dto: EnqueueBrawlerMatchQueueDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const vId = dto.venueId.trim();
    const ranked = Boolean(dto.ranked);
    const heroId = dto.brawlerHeroId.trim();
    if (!heroId) {
      throw new BadRequestException('brawlerHeroId is required for venue queue');
    }
    const heroOk = await this.brawlerRepo.findHeroesByIds([heroId]);
    if (heroOk.length !== 1) {
      throw new BadRequestException('invalid or inactive brawler hero');
    }
    await this.assertAtVenueIfNeeded(vId, dto.latitude, dto.longitude);

    await this.prisma.brawlerMatchQueueEntry.updateMany({
      where: { playerId: player.id, status: BrawlerMatchQueueStatus.WAITING },
      data: { status: BrawlerMatchQueueStatus.CANCELLED },
    });

    await this.prisma.brawlerMatchQueueEntry.create({
      data: {
        venueId: vId,
        playerId: player.id,
        ranked,
        brawlerHeroId: heroId,
      },
    });

    await this.tryMatchVenueBrawlerQueueBucket(vId, ranked);

    return this.getVenueBrawlerQueueStatusForPlayer(player.id, vId);
  }

  async leaveVenueBrawlerQueue(email: string, venueId: string): Promise<{ ok: true }> {
    const player = await this.players.findOrCreateByEmail(email);
    await this.prisma.brawlerMatchQueueEntry.updateMany({
      where: {
        playerId: player.id,
        venueId: venueId.trim(),
        status: BrawlerMatchQueueStatus.WAITING,
      },
      data: { status: BrawlerMatchQueueStatus.CANCELLED },
    });
    return { ok: true as const };
  }

  async getVenueBrawlerQueueStatus(email: string, venueId: string) {
    const player = await this.players.findOrCreateByEmail(email);
    return this.getVenueBrawlerQueueStatusForPlayer(player.id, venueId.trim());
  }

  private async getVenueBrawlerQueueStatusForPlayer(playerId: string, venueId: string) {
    const row = await this.prisma.brawlerMatchQueueEntry.findFirst({
      where: {
        playerId,
        venueId,
        status: { in: [BrawlerMatchQueueStatus.WAITING, BrawlerMatchQueueStatus.MATCHED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { status: 'idle' as const };
    if (row.status === BrawlerMatchQueueStatus.MATCHED && row.matchedSessionId) {
      const sess = await this.prisma.gameSession.findUnique({
        where: { id: row.matchedSessionId },
        select: { status: true },
      });
      if (
        !sess ||
        sess.status === GameSessionStatus.FINISHED ||
        sess.status === GameSessionStatus.CANCELLED
      ) {
        return { status: 'idle' as const };
      }
      return { status: 'matched' as const, sessionId: row.matchedSessionId };
    }
    const waitingAhead = await this.prisma.brawlerMatchQueueEntry.count({
      where: {
        venueId,
        ranked: row.ranked,
        status: BrawlerMatchQueueStatus.WAITING,
        createdAt: { lt: row.createdAt },
      },
    });
    return { status: 'waiting' as const, position: waitingAhead + 1 };
  }

  private async tryMatchVenueBrawlerQueueBucket(
    venueId: string,
    ranked: boolean,
  ): Promise<void> {
    let createdSessionId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const pair = await tx.brawlerMatchQueueEntry.findMany({
        where: {
          venueId,
          ranked,
          status: BrawlerMatchQueueStatus.WAITING,
        },
        orderBy: { createdAt: 'asc' },
        take: 2,
      });
      if (pair.length < 2) return;

      const [a, b] = pair;
      if (a.playerId === b.playerId) return;

      const [pa, pb] = await Promise.all([
        tx.player.findUnique({ where: { id: a.playerId }, select: { username: true } }),
        tx.player.findUnique({ where: { id: b.playerId }, select: { username: true } }),
      ]);
      if (!pa || !pb) return;

      const heroIdA = a.brawlerHeroId;
      const heroIdB = b.brawlerHeroId;
      if (!heroIdA || !heroIdB) {
        return;
      }

      const heroes = await tx.brawlerHero.findMany({
        where: { id: { in: [heroIdA, heroIdB] }, isActive: true },
      });
      const heroById = new Map(heroes.map((h) => [h.id, h]));
      const heroA = heroById.get(heroIdA);
      const heroB = heroById.get(heroIdB);
      if (!heroA || !heroB) return;

      const snap = (hero: (typeof heroes)[0]) =>
        ({
          id: hero.id,
          name: hero.name,
          version: hero.version,
          baseHp: hero.baseHp,
          moveSpeed: hero.moveSpeed,
          dashCooldownMs: hero.dashCooldownMs,
          attackDamage: hero.attackDamage,
          attackKnockback: hero.attackKnockback,
        }) as Prisma.InputJsonValue;

      const config = { ranked } as Prisma.InputJsonValue;

      const session = await tx.gameSession.create({
        data: {
          gameType: GameType.BRAWLER,
          status: GameSessionStatus.PENDING,
          venueId,
          config,
          brawlerSession: { create: {} },
          participants: {
            create: [
              {
                playerId: a.playerId,
                isBot: false,
                displayNameSnapshot: pa.username,
                brawlerHeroId: heroIdA,
                characterSnapshot: heroIdA,
                heroSnapshot: snap(heroA),
              },
              {
                playerId: b.playerId,
                isBot: false,
                displayNameSnapshot: pb.username,
                brawlerHeroId: heroIdB,
                characterSnapshot: heroIdB,
                heroSnapshot: snap(heroB),
              },
            ],
          },
        },
      });

      const upd = await tx.brawlerMatchQueueEntry.updateMany({
        where: {
          id: { in: [a.id, b.id] },
          status: BrawlerMatchQueueStatus.WAITING,
        },
        data: {
          status: BrawlerMatchQueueStatus.MATCHED,
          matchedSessionId: session.id,
        },
      });
      if (upd.count !== 2) {
        throw new Error('brawler queue match race: abort transaction');
      }
      createdSessionId = session.id;
    });

    if (createdSessionId) {
      await this.activateBrawlerMatchSession(createdSessionId);
    }
  }

  private async activateBrawlerMatchSession(sessionId: string): Promise<void> {
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session || session.gameType !== GameType.BRAWLER) return;
    if (session.status !== GameSessionStatus.PENDING) return;

    const started = await this.brawlerRepo.startSession(sessionId);
    if (!started || started.status !== GameSessionStatus.ACTIVE) return;

    if (session.venueId) {
      for (const p of session.participants) {
        if (p.playerId && !p.isBot) {
          await this.venuePlayLimit.beginBrawler(p.playerId, session.venueId, sessionId);
        }
      }
    }
    await this.syncBrawlerSnapshot(sessionId);
  }

  private validateParticipants(participants: CreateBrawlerParticipantDto[]) {
    for (const p of participants) {
      if (!p.isBot && !p.playerId) {
        throw new BadRequestException('human participants require playerId');
      }
      if (p.isBot && !p.botName) {
        throw new BadRequestException('bot participants require botName');
      }
    }
  }
}
