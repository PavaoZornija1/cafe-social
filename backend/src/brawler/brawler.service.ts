import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameSessionStatus, type GameEventType, type Prisma } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { BrawlerRepository } from './brawler.repository';
import { GameXpAwardService } from '../stats/game-xp-award.service';
import {
  CreateBrawlerSessionDto,
  type CreateBrawlerParticipantDto,
} from './dto/create-brawler-session.dto';
import { RecordBrawlerEventsDto } from './dto/record-brawler-events.dto';
import { FinalizeBrawlerSessionDto } from './dto/finalize-brawler-session.dto';
import { PickBrawlerPowerupDto } from './dto/pick-brawler-powerup.dto';

@Injectable()
export class BrawlerService {
  /**
   * Temporary in-memory state until we add a realtime layer.
   * Keyed by sessionId.
   */
  private readonly pickedSpawnIdsBySession = new Map<string, Set<string>>();
  private readonly activeBuffsBySession = new Map<
    string,
    Map<
      string,
      Array<{
        powerupId: string;
        effectType: string;
        magnitude: number;
        startedAtMs: number;
        endsAtMs: number;
      }>
    >
  >();

  constructor(
    private readonly brawlerRepo: BrawlerRepository,
    private readonly players: PlayerService,
    private readonly venuePlayLimit: VenuePlayLimitService,
    private readonly gameXp: GameXpAwardService,
  ) {}

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

    const powerups = await this.brawlerRepo.findEnabledPowerups();

    return this.brawlerRepo.createSession({
      venueId: dto.venueId,
      partyId: dto.partyId,
      config: {
        brawler: {
          powerups: powerups.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            description: p.description,
            effectType: p.effectType,
            magnitude: p.magnitude,
            durationMs: p.durationMs,
            spawnWeight: p.spawnWeight,
            version: p.version,
          })),
        },
      } satisfies Prisma.InputJsonValue,
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
  }

  async getSession(sessionId: string) {
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session) throw new NotFoundException('session not found');
    return session;
  }

  async startSession(sessionId: string, email: string) {
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
    return session;
  }

  async recordEvents(sessionId: string, dto: RecordBrawlerEventsDto) {
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

    return { inserted: created.count };
  }

  async finalizeSession(sessionId: string, dto: FinalizeBrawlerSessionDto) {
    const existingSession = await this.brawlerRepo.findSessionById(sessionId);
    if (!existingSession) throw new NotFoundException('session not found');
    if (existingSession.status === GameSessionStatus.FINISHED) {
      throw new BadRequestException('session already finished');
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
    return session;
  }

  async pickPowerup(sessionId: string, dto: PickBrawlerPowerupDto) {
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not active');
    }

    const participantIds = new Set(session.participants.map((p) => p.id));
    if (!participantIds.has(dto.actorParticipantId)) {
      throw new BadRequestException('actorParticipantId is not in this session');
    }

    const pickedSet =
      this.pickedSpawnIdsBySession.get(sessionId) ?? new Set<string>();
    if (pickedSet.has(dto.spawnId)) {
      return { applied: false, reason: 'ALREADY_PICKED' as const };
    }

    const config = (session.config ?? {}) as any;
    const powerups: any[] = config?.brawler?.powerups ?? [];
    const def = powerups.find((p) => p?.id === dto.powerupId);
    if (!def) {
      throw new BadRequestException('powerupId is not allowed in this session');
    }

    const durationMs = Number(def.durationMs);
    const magnitude = Number(def.magnitude);
    const effectType = String(def.effectType);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new BadRequestException('invalid powerup definition duration');
    }
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new BadRequestException('invalid powerup definition magnitude');
    }

    pickedSet.add(dto.spawnId);
    this.pickedSpawnIdsBySession.set(sessionId, pickedSet);

    const endsAtMs = dto.atMs + durationMs;
    const byParticipant =
      this.activeBuffsBySession.get(sessionId) ?? new Map<string, any[]>();
    const buffs = byParticipant.get(dto.actorParticipantId) ?? [];

    // Stacking rule (simple): if same powerup is active, refresh its end time.
    const existing = buffs.find((b) => b.powerupId === dto.powerupId);
    if (existing) {
      existing.startedAtMs = dto.atMs;
      existing.endsAtMs = endsAtMs;
      existing.magnitude = magnitude;
      existing.effectType = effectType;
    } else {
      buffs.push({
        powerupId: dto.powerupId,
        effectType,
        magnitude,
        startedAtMs: dto.atMs,
        endsAtMs,
      });
    }
    byParticipant.set(dto.actorParticipantId, buffs);
    this.activeBuffsBySession.set(sessionId, byParticipant);

    await this.brawlerRepo.createEvents(sessionId, [
      {
        atMs: dto.atMs,
        eventType: 'POWERUP_PICKED' as GameEventType,
        actorParticipantId: dto.actorParticipantId,
        payload: {
          spawnId: dto.spawnId,
          powerupId: dto.powerupId,
          effectType,
          magnitude,
          durationMs,
          ...(typeof dto.x === 'number' ? { x: dto.x } : {}),
          ...(typeof dto.y === 'number' ? { y: dto.y } : {}),
        } as Prisma.InputJsonValue,
      },
    ]);

    return {
      applied: true,
      spawnId: dto.spawnId,
      powerupId: dto.powerupId,
      effectType,
      magnitude,
      startedAtMs: dto.atMs,
      endsAtMs,
    };
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

