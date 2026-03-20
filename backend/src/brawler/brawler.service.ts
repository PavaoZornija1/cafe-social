import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameSessionStatus, type GameEventType, type Prisma } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { BrawlerRepository } from './brawler.repository';
import {
  CreateBrawlerSessionDto,
  type CreateBrawlerParticipantDto,
} from './dto/create-brawler-session.dto';
import { RecordBrawlerEventsDto } from './dto/record-brawler-events.dto';
import { FinalizeBrawlerSessionDto } from './dto/finalize-brawler-session.dto';

@Injectable()
export class BrawlerService {
  constructor(
    private readonly brawlerRepo: BrawlerRepository,
    private readonly players: PlayerService,
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

    return this.brawlerRepo.createSession({
      venueId: dto.venueId,
      partyId: dto.partyId,
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

  async startSession(sessionId: string) {
    const session = await this.brawlerRepo.startSession(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not pending');
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
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.status === GameSessionStatus.FINISHED) {
      throw new BadRequestException('session already finished');
    }

    const participantIds = new Set(session.participants.map((p) => p.id));
    for (const p of dto.participants) {
      if (!participantIds.has(p.participantId)) {
        throw new BadRequestException('participantId is not in this session');
      }
    }
    if (dto.winnerParticipantId && !participantIds.has(dto.winnerParticipantId)) {
      throw new BadRequestException('winnerParticipantId is not in this session');
    }

    return this.brawlerRepo.finalizeSession({
      sessionId,
      winnerParticipantId: dto.winnerParticipantId,
      participants: dto.participants,
    });
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

