import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  BrawlerMatchQueueStatus,
  GameSessionStatus,
  GameType,
  type GameEventType,
  GameParticipantResult,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { VenuePlayBudgetService } from '../venue/venue-play-budget.service';
import { VenueService } from '../venue/venue.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { BrawlerRepository } from './brawler.repository';
import {
  CreateBrawlerSessionDto,
  type CreateBrawlerParticipantDto,
} from './dto/create-brawler-session.dto';
import { CreatePartyBrawlerSessionDto } from './dto/create-party-brawler-session.dto';
import { RecordBrawlerEventsDto } from './dto/record-brawler-events.dto';
import { FinalizeBrawlerSessionDto } from './dto/finalize-brawler-session.dto';
import { PickBrawlerPowerupDto } from './dto/pick-brawler-powerup.dto';
import type { EnqueueBrawlerMatchQueueDto } from './dto/enqueue-brawler-match-queue.dto';
import { BrawlerLiveRedisService } from './brawler-live-redis.service';
import { BrawlerArenaRedisService } from './brawler-arena-redis.service';
import { BrawlerCombatRedisService } from './brawler-combat-redis.service';
import { BrawlerCombatSimService } from './brawler-combat-sim.service';
import {
  arenaSpawnsForClient,
  maybeSpawnArenaPowerup,
} from './brawler-arena.util';
import type { BrawlerPowerupConfigRow } from './brawler-arena.types';
import type {
  BrawlerCombatFighterV1,
  BrawlerCombatLiveStateV1,
} from './brawler-combat.types';
import { secondsToTicks } from './brawler-combat.types';
import type { BrawlerCombatInputV1 } from './brawler-combat-step';
import { combatWorldFromRef, DEFAULT_BRAWLER_FORFEIT_IDLE_MS } from './brawler-combat.constants';
import { applyForfeitsToState } from './brawler-combat-forfeit.util';
import { spawnFightersOnBottomPlatform } from './brawler-arena-platforms.util';
import { buildFinalizeFromCombat } from './brawler-combat-finalize';
import {
  BRAWLER_COMBAT_ENDED_EVENT,
  BRAWLER_COMBAT_EVENT,
  type BrawlerCombatEndedPayload,
  type BrawlerCombatSocketPayload,
} from './brawler-combat.events';
import {
  BRAWLER_ARENA_EVENT,
  type BrawlerArenaSocketPayload,
} from './brawler-arena.events';
import type { TickBrawlerArenaDto } from './dto/tick-brawler-arena.dto';
import { resolveIfSnapshotRev } from '../game-runtime/snapshot-rev.util';
import { PostGameService } from '../post-game/post-game.service';
import { PushService } from '../push/push.service';

/** Party-of-one / unmatched casual wait ceiling before "no opponents" timeout. */
const BRAWLER_QUEUE_WAIT_TTL_MS = 90_000;
/** Stale ACTIVE rooms (clients crashed / abandoned without abandon()). */
const BRAWLER_ACTIVE_SESSION_MAX_AGE_MS = 45 * 60 * 1000;

type BrawlerSessionView = NonNullable<Awaited<ReturnType<BrawlerRepository['findSessionById']>>>;

export type BrawlerSessionPayload = BrawlerSessionView & { snapshotRev: number | null };

@Injectable()
export class BrawlerService {
  private readonly log = new Logger(BrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brawlerRepo: BrawlerRepository,
    private readonly players: PlayerService,
    private readonly venuePlayLimit: VenuePlayLimitService,
    private readonly venuePlayBudget: VenuePlayBudgetService,
    private readonly venues: VenueService,
    private readonly postGame: PostGameService,
    private readonly brawlerLive: BrawlerLiveRedisService,
    private readonly brawlerArena: BrawlerArenaRedisService,
    private readonly brawlerCombat: BrawlerCombatRedisService,
    @Inject(forwardRef(() => BrawlerCombatSimService))
    private readonly brawlerCombatSim: BrawlerCombatSimService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: EventEmitter2,
    private readonly pushNotifications: PushService,
    private readonly config: ConfigService,
  ) {}

  forfeitIdleMs(): number {
    const raw = this.config.get<string>('BRAWLER_FORFEIT_IDLE_MS');
    const n = raw != null ? Number(raw) : DEFAULT_BRAWLER_FORFEIT_IDLE_MS;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_BRAWLER_FORFEIT_IDLE_MS;
  }

  private emitCombat(state: BrawlerCombatLiveStateV1): void {
    const payload: BrawlerCombatSocketPayload = {
      sessionId: state.sessionId,
      type: 'snapshot',
      state,
    };
    this.events.emit(BRAWLER_COMBAT_EVENT, payload);
    if (state.status === 'ENDED') {
      this.events.emit(BRAWLER_COMBAT_ENDED_EVENT, {
        sessionId: state.sessionId,
        state,
      } satisfies BrawlerCombatEndedPayload);
    }
  }

  private emitArena(payload: BrawlerArenaSocketPayload) {
    this.events.emit(BRAWLER_ARENA_EVENT, payload);
  }

  private heroSnapshotFields(heroSnapshot: unknown): {
    maxHp: number;
    moveSpeedMul: number;
    attackDamage: number;
    dashCooldownS: number;
  } {
    const snap = heroSnapshot as {
      baseHp?: number;
      moveSpeed?: number;
      attackDamage?: number;
      dashCooldownMs?: number;
    } | null;
    const maxHp =
      typeof snap?.baseHp === 'number' &&
      Number.isFinite(snap.baseHp) &&
      snap.baseHp > 0
        ? Math.floor(snap.baseHp)
        : 100;
    const moveSpeedMul =
      typeof snap?.moveSpeed === 'number' && snap.moveSpeed > 0
        ? snap.moveSpeed
        : 1;
    const attackDamage =
      typeof snap?.attackDamage === 'number' && snap.attackDamage > 0
        ? Math.round(snap.attackDamage)
        : 14;
    const dashCooldownS =
      typeof snap?.dashCooldownMs === 'number' && snap.dashCooldownMs > 0
        ? snap.dashCooldownMs / 1000
        : 2.2;
    return { maxHp, moveSpeedMul, attackDamage, dashCooldownS };
  }

  private buildCombatFighters(
    participants: BrawlerSessionView['participants'],
    world: { w: number; h: number },
  ): BrawlerCombatFighterV1[] {
    const active = participants.filter((p) => !p.leftAt);
    const spawns = spawnFightersOnBottomPlatform(
      active.length,
      world.w,
      world.h,
    );
    return active.map((p, i) => {
      const stats = this.heroSnapshotFields(p.heroSnapshot);
      const spawn = spawns[i] ?? spawns[0]!;
      const dashCooldownTicks = secondsToTicks(stats.dashCooldownS);
      return {
        participantId: p.id,
        playerId: p.playerId,
        isBot: p.isBot,
        brawlerHeroId: p.brawlerHeroId ?? null,
        x: spawn.x,
        y: spawn.y,
        prevY: spawn.y,
        vx: 0,
        vy: 0,
        facing: i % 2 === 0 ? 1 : -1,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        alive: true,
        kills: 0,
        deaths: 0,
        onGround: true,
        airJumpsLeft: 1,
        iFramesLeftTicks: 0,
        meleeReadyTick: 0,
        dashTimeLeftTicks: 0,
        dashCooldownLeftTicks: 0,
        attackTimeLeftTicks: 0,
        moveSpeedMul: stats.moveSpeedMul,
        attackDamage: stats.attackDamage,
        dashCooldownTicks,
        cooldowns: {},
        buffs: [],
      };
    });
  }

  private async initCombatForSession(session: BrawlerSessionView): Promise<void> {
    const startedAtMs = Date.now();
    const b = session.brawlerSession;
    const totalMs =
      (b?.chaosDurationMs ?? 45_000) +
      (b?.endgameDurationMs ?? 15_000) +
      (b?.suddenDeathMaxMs ?? 15_000);
    const world = combatWorldFromRef();
    await this.brawlerCombat.initState({
      sessionId: session.id,
      startedAtMs,
      endsAtMs: startedAtMs + totalMs,
      world,
      fighters: this.buildCombatFighters(session.participants, world),
    });
    const humanParticipantIds = session.participants
      .filter((p) => !p.isBot && !p.leftAt)
      .map((p) => p.id);
    const presenceInit: Record<string, number> = {};
    for (const id of humanParticipantIds) {
      presenceInit[id] = startedAtMs;
    }
    await this.brawlerCombat.initPresence(session.id, presenceInit);
    this.brawlerCombatSim.registerSession(session.id);
  }

  private async clearLiveMatchState(sessionId: string): Promise<void> {
    this.brawlerCombatSim.unregisterSession(sessionId);
    await this.brawlerArena.removeState(sessionId);
    await this.brawlerCombat.removeState(sessionId);
  }

  async getCombatState(sessionId: string, email: string) {
    await this.assertSessionParticipant(sessionId, email);
    return this.brawlerCombat.readState(sessionId);
  }

  async submitCombatInput(
    sessionId: string,
    email: string,
    input: Omit<BrawlerCombatInputV1, 'participantId'> & {
      participantId?: string;
    },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const { session, playerId } = await this.assertSessionParticipant(
      sessionId,
      email,
    );
    if (session.status !== GameSessionStatus.ACTIVE) {
      return { ok: false, error: 'not_active' };
    }
    const participant = session.participants.find(
      (p) => p.playerId === playerId && !p.leftAt,
    );
    if (!participant) return { ok: false, error: 'forbidden' };
    const combat = await this.brawlerCombat.readState(sessionId);
    const fighter = combat?.fighters.find(
      (f) => f.participantId === participant.id,
    );
    if (fighter && !fighter.alive) {
      return { ok: false, error: 'forfeited' };
    }
    if (
      input.participantId &&
      input.participantId !== participant.id
    ) {
      return { ok: false, error: 'forbidden' };
    }
    const accepted = this.brawlerCombatSim.enqueueInput(sessionId, {
      participantId: participant.id,
      seq: input.seq,
      moveX: input.moveX,
      moveY: input.moveY,
      jump: input.jump,
      dash: input.dash,
      fire: input.fire,
      pickup: input.pickup,
    });
    if (!accepted) return { ok: false, error: 'rate_limited' };
    void this.brawlerCombat.touchInput(sessionId, participant.id, Date.now()).catch(
      (e) => {
        this.log.warn(`touchInput ${sessionId}: ${(e as Error).message}`);
      },
    );
    return { ok: true };
  }

  /**
   * Mark participants as forfeited in combat + Postgres. Emits snapshot/ended.
   * Idempotent for already-dead fighters.
   */
  async applyCombatForfeits(
    sessionId: string,
    participantIds: readonly string[],
  ): Promise<BrawlerCombatLiveStateV1 | null> {
    if (participantIds.length === 0) return null;

    const combatBefore = await this.brawlerCombat.readState(sessionId);
    if (!combatBefore || combatBefore.status !== 'ACTIVE') {
      return combatBefore;
    }

    const toForfeit = participantIds.filter((pid) => {
      const f = combatBefore.fighters.find((x) => x.participantId === pid);
      return f?.alive && !f.isBot;
    });
    if (toForfeit.length === 0) {
      return combatBefore;
    }

    const written = await this.brawlerCombat.mutateState(sessionId, (state) =>
      applyForfeitsToState(state, toForfeit),
    );

    await this.prisma.gameParticipant.updateMany({
      where: {
        sessionId,
        id: { in: toForfeit },
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
        result: GameParticipantResult.LOSS,
      },
    });

    for (const pid of toForfeit) {
      this.brawlerCombatSim.clearParticipantInput(sessionId, pid);
    }

    this.emitCombat(written);
    await this.syncBrawlerSnapshot(sessionId);

    if (written.status === 'ENDED') {
      this.brawlerCombatSim.unregisterSession(sessionId);
    }

    return written;
  }

  async forfeitSession(
    sessionId: string,
    email: string,
    ifSnapshotRev?: number,
  ): Promise<{ ok: true; already?: boolean; snapshotRev: number | null }> {
    await this.assertBrawlerIfSnapshotRev(sessionId, ifSnapshotRev);
    const { session, playerId } = await this.assertSessionParticipant(
      sessionId,
      email,
    );
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not active');
    }

    const participant = session.participants.find(
      (p) => p.playerId === playerId && !p.isBot,
    );
    if (!participant) {
      throw new ForbiddenException('not in this session');
    }

    if (participant.leftAt) {
      return {
        ok: true as const,
        already: true,
        snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
      };
    }

    const combat = await this.brawlerCombat.readState(sessionId);
    const fighter = combat?.fighters.find(
      (f) => f.participantId === participant.id,
    );
    if (fighter && !fighter.alive) {
      if (!participant.leftAt) {
        await this.prisma.gameParticipant.update({
          where: { id: participant.id },
          data: {
            leftAt: new Date(),
            result: GameParticipantResult.LOSS,
          },
        });
        await this.syncBrawlerSnapshot(sessionId);
      }
      return {
        ok: true as const,
        already: true,
        snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
      };
    }

    await this.applyCombatForfeits(sessionId, [participant.id]);

    return {
      ok: true as const,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  private powerupDefsFromSession(session: { config?: unknown }): BrawlerPowerupConfigRow[] {
    const config = (session.config ?? {}) as { brawler?: { powerups?: BrawlerPowerupConfigRow[] } };
    return config?.brawler?.powerups ?? [];
  }

  private async powerupConfigRows(): Promise<BrawlerPowerupConfigRow[]> {
    const powerups = await this.brawlerRepo.findEnabledPowerups();
    return powerups.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      description: p.description,
      effectType: p.effectType,
      magnitude: p.magnitude,
      durationMs: p.durationMs,
      spawnWeight: p.spawnWeight,
      version: p.version,
    }));
  }

  private async buildSessionConfig(
    extras: Record<string, unknown>,
  ): Promise<Prisma.InputJsonValue> {
    const powerups = await this.powerupConfigRows();
    return {
      ...extras,
      brawler: { powerups },
    } as Prisma.InputJsonValue;
  }

  async listPowerups() {
    return this.powerupConfigRows();
  }

  private async assertSessionParticipant(
    sessionId: string,
    email: string,
  ): Promise<{ playerId: string; session: NonNullable<Awaited<ReturnType<BrawlerRepository['findSessionById']>>> }> {
    const session = await this.brawlerRepo.findSessionById(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.gameType !== GameType.BRAWLER) {
      throw new BadRequestException('not a brawler session');
    }
    const player = await this.players.findOrCreateByEmail(email);
    const isParticipant = session.participants.some(
      (p) => p.playerId === player.id && !p.leftAt,
    );
    if (!isParticipant) throw new ForbiddenException('not in this session');
    return { playerId: player.id, session };
  }

  async getArenaState(sessionId: string, email: string): Promise<BrawlerArenaSocketPayload> {
    await this.assertSessionParticipant(sessionId, email);
    const state =
      (await this.brawlerArena.readState(sessionId)) ??
      (await this.brawlerArena.initState(sessionId));
    return {
      sessionId,
      type: 'state',
      rev: state.rev,
      spawns: arenaSpawnsForClient(state),
    };
  }

  async tickArena(sessionId: string, email: string, dto: TickBrawlerArenaDto) {
    const { session } = await this.assertSessionParticipant(sessionId, email);
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not active');
    }

    const powerupDefs = this.powerupDefsFromSession(session);
    let spawnedId: string | null = null;
    const state = await this.brawlerArena.mutateState(sessionId, (draft) => {
      const spawned = maybeSpawnArenaPowerup({
        state: draft,
        atMs: dto.atMs,
        worldW: dto.worldW,
        worldH: dto.worldH,
        powerupDefs,
      });
      if (!spawned) return null;
      spawnedId = spawned.spawnId;
      return draft;
    });

    if (!spawnedId) {
      return { spawned: false as const, rev: state.rev };
    }

    const spawn = arenaSpawnsForClient(state).find((s) => s.spawnId === spawnedId);
    if (!spawn) {
      return { spawned: false as const, rev: state.rev };
    }
    this.emitArena({
      sessionId,
      type: 'spawned',
      rev: state.rev,
      spawn,
    });
    return { spawned: true as const, rev: state.rev, spawn };
  }

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

  private async assertPartyMemberIfNeeded(
    partyId: string | null | undefined,
    playerId: string,
  ): Promise<void> {
    const id = partyId?.trim();
    if (!id) return;
    const member = await this.prisma.partyMember.findUnique({
      where: { partyId_playerId: { partyId: id, playerId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a party member');
    }
  }

  listHeroes() {
    return this.brawlerRepo.findActiveHeroes();
  }

  async createSession(email: string, dto: CreateBrawlerSessionDto) {
    const requester = await this.players.findOrCreateByEmail(email);
    const partyId = dto.partyId?.trim() || null;
    await this.assertPartyMemberIfNeeded(partyId, requester.id);
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
    const playerById = new Map(foundPlayers.map((p) => [p.id, p]));

    const config = await this.buildSessionConfig(
      !hasBot && humanCount === 2 ? { ranked: rankedReq } : {},
    );

    const created = await this.brawlerRepo.createSession({
      venueId: dto.venueId,
      partyId: dto.partyId,
      config,
      participants: participants.map((p) => {
        const hero = p.brawlerHeroId ? heroById.get(p.brawlerHeroId) : null;
        const player = p.playerId ? playerById.get(p.playerId) : undefined;
        return {
          playerId: p.playerId,
          isBot: p.isBot,
          botName: p.botName,
          brawlerHeroId: p.brawlerHeroId,
          characterSnapshot: p.brawlerHeroId ?? p.botName,
          displayNameSnapshot: player?.username ?? p.botName,
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

  async createPartySession(email: string, dto: CreatePartyBrawlerSessionDto) {
    const requester = await this.players.findOrCreateByEmail(email);
    const partyId = dto.partyId.trim();

    const party = await this.prisma.party.findUnique({
      where: { id: partyId },
      include: {
        members: {
          include: { player: { select: { id: true, username: true } } },
        },
      },
    });
    if (!party) throw new NotFoundException('party not found');
    if (party.leaderId !== requester.id) {
      throw new ForbiddenException('Only the party leader can start a party brawl');
    }

    const memberIds = new Set(party.members.map((m) => m.playerId));
    if (!memberIds.has(requester.id)) {
      throw new ForbiddenException('Not a party member');
    }

    if (dto.participants.length < 2 || dto.participants.length > 4) {
      throw new BadRequestException('participants must be between 2 and 4');
    }

    const uniquePlayerIds = new Set(dto.participants.map((p) => p.playerId));
    if (uniquePlayerIds.size !== dto.participants.length) {
      throw new BadRequestException('duplicate playerId in participants');
    }

    for (const p of dto.participants) {
      if (!memberIds.has(p.playerId)) {
        throw new BadRequestException('all participants must be party members');
      }
    }

    const participants: CreateBrawlerParticipantDto[] = dto.participants.map((p) => ({
      playerId: p.playerId,
      isBot: false,
      brawlerHeroId: p.brawlerHeroId,
    }));

    return this.createSession(email, {
      venueId: dto.venueId,
      partyId,
      ranked: dto.ranked,
      participants,
    });
  }

  async getSession(sessionId: string, email: string): Promise<BrawlerSessionPayload> {
    await this.assertSessionParticipant(sessionId, email);
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

  async startSession(
    sessionId: string,
    email: string,
    ifSnapshotRev?: number,
    latitude?: number,
    longitude?: number,
  ) {
    await this.assertBrawlerIfSnapshotRev(sessionId, ifSnapshotRev);
    const { session: full } = await this.assertSessionParticipant(sessionId, email);
    const session = await this.brawlerRepo.startSession(sessionId);
    if (!session) throw new NotFoundException('session not found');
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not pending');
    }
    if (session.venueId) {
      const player = await this.players.findOrCreateByEmail(email);
      const human = full.participants.find((p) => p.playerId === player.id && !p.isBot);
      if (human) {
        const sub = await this.subscriptions.isActiveSubscriber(player.id);
        if (!sub) {
          const hasCoords =
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude);
          if (!hasCoords) {
            throw new ForbiddenException(
              'Brawler at a venue requires your current location (lat/lng) for play-time tracking.',
            );
          }
          await this.venuePlayBudget.assertCanStartVenuePlayAtVenueWithCoords(
            player.id,
            session.venueId,
            latitude,
            longitude,
          );
        }
        await this.venuePlayLimit.beginBrawler(player.id, session.venueId, sessionId);
      }
    }
    await this.brawlerArena.initState(sessionId);
    await this.initCombatForSession(full);
    await this.syncBrawlerSnapshot(sessionId);
    await this.notifyBrawlerMatchStarting(sessionId, full);
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
    await this.clearLiveMatchState(sessionId);
    await this.syncBrawlerSnapshot(sessionId);
    return {
      ok: true as const,
      snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
    };
  }

  async recordEvents(
    sessionId: string,
    email: string,
    dto: RecordBrawlerEventsDto,
    ifMatchHeader?: string,
  ) {
    await this.assertBrawlerIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const { session } = await this.assertSessionParticipant(sessionId, email);
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

  async finalizeSession(
    sessionId: string,
    dto: FinalizeBrawlerSessionDto,
    email: string,
    ifMatchHeader?: string,
  ) {
    await this.assertBrawlerIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const { playerId, session: existingSession } = await this.assertSessionParticipant(
      sessionId,
      email,
    );
    if (existingSession.status === GameSessionStatus.FINISHED) {
      // Idempotent: never overwrite a finished winner with a contradictory client claim.
      const postGame = await this.postGame.getForGameSession(sessionId, playerId);
      return {
        ...existingSession,
        snapshotRev: await this.readBrawlerSnapshotRev(sessionId),
        postGame,
      };
    }
    if (existingSession.status === GameSessionStatus.CANCELLED) {
      throw new BadRequestException('session was cancelled');
    }
    if (existingSession.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not active');
    }

    const combat = await this.brawlerCombat.readState(sessionId);
    const humans = existingSession.participants.filter((p) => !p.isBot);

    let winnerParticipantId = dto.winnerParticipantId;
    let participants = dto.participants ?? [];

    if (combat?.status === 'ENDED') {
      const fromCombat = buildFinalizeFromCombat(combat);
      winnerParticipantId = fromCombat.winnerParticipantId;
      participants = fromCombat.participants;
    } else if (humans.length >= 2) {
      // Multi-human requires authoritative combat end — refuse client-claimed results.
      throw new BadRequestException(
        'multi-human brawler finalize waits for authoritative combat end',
      );
    } else {
      // Solo / human+bot winner while combat is still ACTIVE.
      if (!dto.participants?.length) {
        throw new BadRequestException('participants are required when combat is still active');
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
      participants = dto.participants;
    }

    return this.commitFinalize({
      sessionId,
      playerId,
      winnerParticipantId,
      participants: participants.map((p) => ({
        participantId: p.participantId,
        placement: p.placement,
        score: p.score,
        result:
          p.result === 'WIN' || p.result === 'LOSS' || p.result === 'DRAW'
            ? p.result
            : undefined,
        kills: p.kills,
        deaths: p.deaths,
      })),
    });
  }

  /**
   * System finalize when the combat tick owner marks the match ENDED.
   * Idempotent if Postgres already FINISHED.
   */
  @OnEvent(BRAWLER_COMBAT_ENDED_EVENT)
  async onCombatEnded(payload: BrawlerCombatEndedPayload): Promise<void> {
    if (!payload?.sessionId || payload.state?.status !== 'ENDED') return;
    try {
      await this.finalizeFromCombatDocument(payload.sessionId);
    } catch (e) {
      this.log.warn(
        `onCombatEnded ${payload.sessionId}: ${(e as Error).message}`,
      );
    }
  }

  async finalizeFromCombatDocument(sessionId: string): Promise<void> {
    const existing = await this.brawlerRepo.findSessionById(sessionId);
    if (!existing || existing.gameType !== GameType.BRAWLER) return;
    if (existing.status === GameSessionStatus.FINISHED) {
      await this.clearLiveMatchState(sessionId);
      return;
    }
    if (existing.status !== GameSessionStatus.ACTIVE) return;

    const combat = await this.brawlerCombat.readState(sessionId);
    if (!combat || combat.status !== 'ENDED') return;

    const fromCombat = buildFinalizeFromCombat(combat);
    const session = await this.brawlerRepo.finalizeSession({
      sessionId,
      winnerParticipantId: fromCombat.winnerParticipantId,
      participants: fromCombat.participants,
    });
    if (!session) return;
    await this.postGame.onGameSessionFinished(sessionId);
    await this.clearLiveMatchState(sessionId);
    await this.syncBrawlerSnapshot(sessionId);
  }

  private async commitFinalize(params: {
    sessionId: string;
    playerId: string;
    winnerParticipantId?: string;
    participants: Array<{
      participantId: string;
      placement?: number;
      score?: number;
      result?: GameParticipantResult;
      kills?: number;
      deaths?: number;
    }>;
  }) {
    const session = await this.brawlerRepo.finalizeSession({
      sessionId: params.sessionId,
      winnerParticipantId: params.winnerParticipantId,
      participants: params.participants,
    });
    if (!session) {
      // Lost the ACTIVE→FINISHED claim race — return the winner's finished session.
      const again = await this.brawlerRepo.findSessionById(params.sessionId);
      if (again?.status === GameSessionStatus.FINISHED) {
        const postGame = await this.postGame.getForGameSession(
          params.sessionId,
          params.playerId,
        );
        return {
          ...again,
          snapshotRev: await this.readBrawlerSnapshotRev(params.sessionId),
          postGame,
        };
      }
      throw new ConflictException('session finalize race');
    }
    await this.postGame.onGameSessionFinished(params.sessionId);
    const postGame = await this.postGame.getForGameSession(
      params.sessionId,
      params.playerId,
    );
    await this.clearLiveMatchState(params.sessionId);
    await this.syncBrawlerSnapshot(params.sessionId);
    return {
      ...session,
      snapshotRev: await this.readBrawlerSnapshotRev(params.sessionId),
      postGame,
    };
  }

  async enqueueVenueBrawlerMatch(email: string, dto: EnqueueBrawlerMatchQueueDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const partyId = dto.partyId?.trim() || null;
    await this.assertPartyMemberIfNeeded(partyId, player.id);
    const rawVenueId = dto.venueId?.trim() || null;
    const ranked = Boolean(dto.ranked);
    const heroId = dto.brawlerHeroId.trim();
    if (!heroId) {
      throw new BadRequestException('brawlerHeroId is required for the brawler queue');
    }
    const heroOk = await this.brawlerRepo.findHeroesByIds([heroId]);
    if (heroOk.length !== 1) {
      throw new BadRequestException('invalid or inactive brawler hero');
    }

    let vId: string | null = null;
    if (rawVenueId) {
      // Gating only — players at a venue must be inside its geofence.
      // The matchmaker pool itself is global (cross-venue) below.
      await this.assertAtVenueIfNeeded(rawVenueId, dto.latitude, dto.longitude);
      vId = rawVenueId;
    } else {
      // No venue: caller must be an active subscriber (queue-from-anywhere).
      const subOk = await this.subscriptions.isActiveSubscriber(player.id);
      if (!subOk) {
        throw new ForbiddenException(
          'Queueing without a venue requires an active subscription',
        );
      }
    }

    await this.prisma.brawlerMatchQueueEntry.updateMany({
      where: { playerId: player.id, status: BrawlerMatchQueueStatus.WAITING },
      data: { status: BrawlerMatchQueueStatus.CANCELLED },
    });

    await this.prisma.brawlerMatchQueueEntry.create({
      data: {
        venueId: vId,
        playerId: player.id,
        partyId,
        ranked,
        brawlerHeroId: heroId,
      },
    });

    await this.tryMatchBrawlerQueueBucket(ranked);

    return this.getVenueBrawlerQueueStatusForPlayer(player.id, vId);
  }

  async leaveVenueBrawlerQueue(email: string, venueId?: string | null): Promise<{ ok: true }> {
    const player = await this.players.findOrCreateByEmail(email);
    const v = venueId?.trim() || null;
    await this.prisma.brawlerMatchQueueEntry.updateMany({
      where: {
        playerId: player.id,
        ...(v ? { venueId: v } : {}),
        status: BrawlerMatchQueueStatus.WAITING,
      },
      data: { status: BrawlerMatchQueueStatus.CANCELLED },
    });
    return { ok: true as const };
  }

  async getVenueBrawlerQueueStatus(email: string, venueId?: string | null) {
    const player = await this.players.findOrCreateByEmail(email);
    return this.getVenueBrawlerQueueStatusForPlayer(player.id, venueId?.trim() || null);
  }

  private async getVenueBrawlerQueueStatusForPlayer(playerId: string, _venueId: string | null) {
    await this.expireStaleBrawlerQueueEntriesForPlayer(playerId);

    const row = await this.prisma.brawlerMatchQueueEntry.findFirst({
      where: {
        playerId,
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

    const waitedMs = Date.now() - row.createdAt.getTime();
    if (waitedMs >= BRAWLER_QUEUE_WAIT_TTL_MS) {
      await this.prisma.brawlerMatchQueueEntry.updateMany({
        where: { id: row.id, status: BrawlerMatchQueueStatus.WAITING },
        data: { status: BrawlerMatchQueueStatus.CANCELLED },
      });
      return { status: 'timed_out' as const };
    }

    // Position is global across all venues — players can be paired with anyone in the same rules bucket.
    const waitingAhead = await this.prisma.brawlerMatchQueueEntry.count({
      where: {
        ranked: row.ranked,
        partyId: row.partyId,
        status: BrawlerMatchQueueStatus.WAITING,
        createdAt: { lt: row.createdAt },
      },
    });
    return {
      status: 'waiting' as const,
      position: waitingAhead + 1,
      waitedMs,
      waitTtlMs: BRAWLER_QUEUE_WAIT_TTL_MS,
    };
  }

  private async expireStaleBrawlerQueueEntriesForPlayer(playerId: string): Promise<void> {
    const cutoff = new Date(Date.now() - BRAWLER_QUEUE_WAIT_TTL_MS);
    await this.prisma.brawlerMatchQueueEntry.updateMany({
      where: {
        playerId,
        status: BrawlerMatchQueueStatus.WAITING,
        createdAt: { lt: cutoff },
      },
      data: { status: BrawlerMatchQueueStatus.CANCELLED },
    });
  }

  /** Cancels WAITING brawler queue rows older than the wait TTL (party-of-one / unmatched). */
  async expireStaleBrawlerQueueEntries(): Promise<number> {
    const cutoff = new Date(Date.now() - BRAWLER_QUEUE_WAIT_TTL_MS);
    const res = await this.prisma.brawlerMatchQueueEntry.updateMany({
      where: {
        status: BrawlerMatchQueueStatus.WAITING,
        createdAt: { lt: cutoff },
      },
      data: { status: BrawlerMatchQueueStatus.CANCELLED },
    });
    return res.count;
  }

  /**
   * Reap abandoned ACTIVE brawler sessions with no recent activity / started long ago.
   */
  async reapStaleActiveBrawlerSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - BRAWLER_ACTIVE_SESSION_MAX_AGE_MS);
    const stale = await this.prisma.gameSession.findMany({
      where: {
        gameType: GameType.BRAWLER,
        status: GameSessionStatus.ACTIVE,
        OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, createdAt: { lt: cutoff } }],
      },
      select: { id: true },
      take: 50,
    });
    if (stale.length === 0) return 0;

    const res = await this.prisma.gameSession.updateMany({
      where: {
        id: { in: stale.map((s) => s.id) },
        gameType: GameType.BRAWLER,
        status: GameSessionStatus.ACTIVE,
      },
      data: {
        status: GameSessionStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
    for (const s of stale) {
      await this.clearLiveMatchState(s.id);
      await this.syncBrawlerSnapshot(s.id);
    }
    return res.count;
  }

  /** Casual-only queue bot-fill: pair one WAITING row with Chaos Bot (same hero as human). */
  async tryFillBrawlerQueueWithBot(queueEntryId: string): Promise<string | null> {
    let createdSessionId: string | null = null;
    const powerups = await this.powerupConfigRows();
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.brawlerMatchQueueEntry.findUnique({
        where: { id: queueEntryId },
      });
      if (!row || row.status !== BrawlerMatchQueueStatus.WAITING || row.ranked || row.partyId) {
        return;
      }

      const heroId = row.brawlerHeroId;
      if (!heroId) return;

      const pa = await tx.player.findUnique({
        where: { id: row.playerId },
        select: { username: true },
      });
      if (!pa) return;

      const heroes = await tx.brawlerHero.findMany({
        where: { id: heroId, isActive: true },
      });
      if (heroes.length !== 1) return;
      const hero = heroes[0]!;

      const snap = (h: (typeof heroes)[0]) =>
        ({
          id: h.id,
          name: h.name,
          version: h.version,
          baseHp: h.baseHp,
          moveSpeed: h.moveSpeed,
          dashCooldownMs: h.dashCooldownMs,
          attackDamage: h.attackDamage,
          attackKnockback: h.attackKnockback,
        }) as Prisma.InputJsonValue;

      const playerVenueIds: Record<string, string> = {};
      if (row.venueId) playerVenueIds[row.playerId] = row.venueId;

      const config = {
        ranked: false,
        playerVenueIds,
        brawler: { powerups },
      } as Prisma.InputJsonValue;

      const session = await tx.gameSession.create({
        data: {
          gameType: GameType.BRAWLER,
          status: GameSessionStatus.PENDING,
          venueId: row.venueId ?? null,
          config,
          brawlerSession: { create: {} },
          participants: {
            create: [
              {
                playerId: row.playerId,
                isBot: false,
                displayNameSnapshot: pa.username,
                brawlerHeroId: heroId,
                characterSnapshot: heroId,
                heroSnapshot: snap(hero),
              },
              {
                playerId: null,
                isBot: true,
                botName: 'Chaos Bot',
                brawlerHeroId: heroId,
                characterSnapshot: heroId,
                heroSnapshot: snap(hero),
              },
            ],
          },
        },
      });

      const upd = await tx.brawlerMatchQueueEntry.updateMany({
        where: {
          id: row.id,
          status: BrawlerMatchQueueStatus.WAITING,
        },
        data: {
          status: BrawlerMatchQueueStatus.MATCHED,
          matchedSessionId: session.id,
        },
      });
      if (upd.count !== 1) {
        await tx.gameSession.delete({ where: { id: session.id } });
        return;
      }
      createdSessionId = session.id;
    });

    if (createdSessionId) {
      await this.activateBrawlerMatchSession(createdSessionId);
    }
    return createdSessionId;
  }

  private async tryMatchBrawlerQueueBucket(ranked: boolean): Promise<void> {
    let createdSessionId: string | null = null;
    const powerups = await this.powerupConfigRows();
    await this.prisma.$transaction(async (tx) => {
      // Ranked: pair any two WAITING ranked entries.
      // Casual: only party queues may pair two humans; open casual uses bot-fill.
      let pair: Array<{
        id: string;
        playerId: string;
        venueId: string | null;
        partyId: string | null;
        brawlerHeroId: string | null;
      }> = [];

      if (ranked) {
        pair = await tx.brawlerMatchQueueEntry.findMany({
          where: {
            ranked: true,
            status: BrawlerMatchQueueStatus.WAITING,
          },
          orderBy: { createdAt: 'asc' },
          take: 2,
        });
      } else {
        const anchor = await tx.brawlerMatchQueueEntry.findFirst({
          where: {
            ranked: false,
            partyId: { not: null },
            status: BrawlerMatchQueueStatus.WAITING,
          },
          orderBy: { createdAt: 'asc' },
          select: { partyId: true },
        });
        if (!anchor?.partyId) return;

        pair = await tx.brawlerMatchQueueEntry.findMany({
          where: {
            ranked: false,
            partyId: anchor.partyId,
            status: BrawlerMatchQueueStatus.WAITING,
          },
          orderBy: { createdAt: 'asc' },
          take: 2,
        });
      }
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

      const playerVenueIds: Record<string, string> = {};
      if (a.venueId) playerVenueIds[a.playerId] = a.venueId;
      if (b.venueId) playerVenueIds[b.playerId] = b.venueId;
      const config = {
        ranked,
        playerVenueIds,
        brawler: { powerups },
      } as Prisma.InputJsonValue;

      const session = await tx.gameSession.create({
        data: {
          gameType: GameType.BRAWLER,
          status: GameSessionStatus.PENDING,
          // Host's venue (or null when host is a subscriber queueing from outside any venue).
          // Per-player play limits below use each participant's own venue from `playerVenueIds`.
          venueId: a.venueId ?? null,
          partyId: a.partyId ?? null,
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

    const cfg = (session.config ?? {}) as { playerVenueIds?: Record<string, string> };
    const playerVenueIds = cfg.playerVenueIds ?? {};
    for (const p of session.participants) {
      if (!p.playerId || p.isBot) continue;
      const venueId = playerVenueIds[p.playerId] ?? session.venueId ?? null;
      if (!venueId) continue;
      const sub = await this.subscriptions.isActiveSubscriber(p.playerId);
      if (!sub) {
        await this.venuePlayBudget.assertHasRemainingVenuePlayBudget(p.playerId, venueId);
      }
    }

    const started = await this.brawlerRepo.startSession(sessionId);
    if (!started || started.status !== GameSessionStatus.ACTIVE) return;

    for (const p of session.participants) {
      if (!p.playerId || p.isBot) continue;
      const venueId = playerVenueIds[p.playerId] ?? session.venueId ?? null;
      if (!venueId) continue;
      await this.venuePlayLimit.beginBrawler(p.playerId, venueId, sessionId);
    }
    await this.brawlerArena.initState(sessionId);
    await this.initCombatForSession(session);
    await this.syncBrawlerSnapshot(sessionId);

    await this.notifyBrawlerMatchStarting(sessionId, session);
  }

  private async notifyBrawlerMatchStarting(
    sessionId: string,
    session: BrawlerSessionView,
    participantIds?: string[],
  ): Promise<void> {
    const ids =
      participantIds ??
      session.participants
        .filter((p) => p.playerId && !p.isBot)
        .map((p) => p.playerId as string);
    if (ids.length === 0) return;
    void this.pushNotifications.sendToPlayers(
      ids,
      undefined,
      {
        title: 'Cafe Social',
        body: 'Brawler match is starting — open the app to play!',
        data: {
          type: 'brawler_match_start',
          sessionId,
          venueId: session.venueId ?? '',
          pushCategory: 'match',
        },
      },
      { channel: 'match' },
    );
  }

  async pickPowerup(sessionId: string, email: string, dto: PickBrawlerPowerupDto) {
    const { session } = await this.assertSessionParticipant(sessionId, email);
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('session is not active');
    }

    const participantIds = new Set(session.participants.map((p) => p.id));
    if (!participantIds.has(dto.actorParticipantId)) {
      throw new BadRequestException('actorParticipantId is not in this session');
    }

    const powerups = this.powerupDefsFromSession(session);
    const def = powerups.find((p) => p?.id === dto.powerupId);
    if (!def) {
      throw new BadRequestException('powerupId is not allowed in this session');
    }

    const durationMs = Number(def.durationMs);
    const magnitude = Number(def.magnitude);
    const effectType = String(def.effectType);
    const isInstantHeal = effectType === 'HEAL_MAX_HP_PCT';
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new BadRequestException('invalid powerup definition duration');
    }
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      throw new BadRequestException('invalid powerup definition magnitude');
    }

    const pickOutcome: { kind: 'applied' | 'already' | 'missing' } = { kind: 'missing' };
    const endsAtMs = dto.atMs + durationMs;

    const state = await this.brawlerArena.mutateState(sessionId, (draft) => {
      if (draft.pickedSpawnIds.includes(dto.spawnId)) {
        pickOutcome.kind = 'already';
        return null;
      }
      const spawnOnMap = draft.spawns.find((s) => s.spawnId === dto.spawnId);
      if (!spawnOnMap || spawnOnMap.powerupId !== dto.powerupId) {
        pickOutcome.kind = 'missing';
        return null;
      }

      const buffs = draft.buffsByParticipant[dto.actorParticipantId] ?? [];
      const existing = buffs.find((b) => b.powerupId === dto.powerupId);
      const nextBuff = {
        powerupId: dto.powerupId,
        effectType,
        magnitude,
        startedAtMs: dto.atMs,
        endsAtMs,
      };
      pickOutcome.kind = 'applied';
      return {
        ...draft,
        spawns: draft.spawns.filter((s) => s.spawnId !== dto.spawnId),
        pickedSpawnIds: [...draft.pickedSpawnIds, dto.spawnId],
        buffsByParticipant: isInstantHeal
          ? draft.buffsByParticipant
          : {
              ...draft.buffsByParticipant,
              [dto.actorParticipantId]: existing
                ? buffs.map((b) => (b.powerupId === dto.powerupId ? nextBuff : b))
                : [...buffs, nextBuff],
            },
      };
    });

    if (pickOutcome.kind === 'already') {
      return { applied: false, reason: 'ALREADY_PICKED' as const, spawnId: dto.spawnId };
    }
    if (pickOutcome.kind !== 'applied') {
      throw new BadRequestException('spawnId is not on the map');
    }

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

    this.emitArena({
      sessionId,
      type: 'picked',
      rev: state.rev,
      picked: {
        spawnId: dto.spawnId,
        actorParticipantId: dto.actorParticipantId,
        powerupId: dto.powerupId,
        effectType,
        magnitude,
        startedAtMs: dto.atMs,
        endsAtMs,
      },
    });

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
