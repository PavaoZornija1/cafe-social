import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  GameParticipantResult,
  GameSessionStatus,
  GameType,
  WordMatchQueueMode,
  WordMatchQueueStatus,
  ChallengeAutoProgressSource,
  type Prisma,
  type PrismaClient,
  type WordCategory,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { WordRepository } from './word.repository';
import type { CreateWordMatchDto } from './dto/create-word-match.dto';
import type { EnqueueWordMatchQueueDto } from './dto/enqueue-word-match-queue.dto';
import type { CoopGuessDto } from './dto/coop-guess.dto';
import type { MatchPassDto } from './dto/match-pass.dto';
import { WORD_MATCH_REFRESH_EVENT, type WordMatchRefreshPayload } from './word-match.gateway';
import { wordToPublicHints, type WordPublicHint } from './word-hint.util';
import { PushService } from '../push/push.service';
import { VenueFeedService } from '../venue-feed/venue-feed.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { VenuePlayBudgetService } from '../venue/venue-play-budget.service';
import { VenueService } from '../venue/venue.service';
import { normalizeGuess } from './word-match.util';
import { GameXpAwardService } from '../stats/game-xp-award.service';
import { WordMatchLiveRedisService } from './word-match-live-redis.service';
import type { WordMatchLiveSnapshotV1 } from './word-match-snapshot.util';
import { resolveIfSnapshotRev } from '../game-runtime/snapshot-rev.util';
import { ChallengeService } from '../challenge/challenge.service';

export type WordMatchConfig = {
  wordGameMode: 'coop' | 'versus';
  difficulty: string;
  wordIds: string[];
  hostPlayerId: string;
  category?: WordCategory | null;
  /** Versus ranked: Elo-style rating updates on match end (2 human players). */
  ranked?: boolean;
  /**
   * Per-player venue context — populated for cross-venue queue matches.
   * Each player is geofence-gated to **their own** venue (not `session.venueId`),
   * and per-venue play limits / nudges count against their own venue.
   */
  playerVenueIds?: Record<string, string>;
};

function isParticipantActive(p: {
  playerId: string | null;
  leftAt: Date | null;
  isBot?: boolean;
}): boolean {
  if (p.leftAt) return false;
  if (p.isBot) return true;
  return Boolean(p.playerId);
}

@Injectable()
export class WordMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly wordRepo: WordRepository,
    private readonly events: EventEmitter2,
    private readonly pushNotifications: PushService,
    private readonly venueFeed: VenueFeedService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly venues: VenueService,
    private readonly venuePlayLimit: VenuePlayLimitService,
    private readonly venuePlayBudget: VenuePlayBudgetService,
    private readonly gameXp: GameXpAwardService,
    private readonly liveRedis: WordMatchLiveRedisService,
    private readonly challenges: ChallengeService,
  ) {}

  private mapSnapshotToPublicState(snap: WordMatchLiveSnapshotV1, viewerPlayerId?: string) {
    return {
      sessionId: snap.sessionId,
      status: snap.status,
      mode: snap.mode,
      difficulty: snap.difficulty,
      ranked: snap.ranked,
      venueId: snap.venueId,
      deckLanguage: snap.deckLanguage,
      deckCategory: snap.deckCategory,
      hostPlayerId: snap.hostPlayerId,
      inviteCode: snap.inviteCode,
      targetWordCount: snap.targetWordCount,
      sharedWordIndex: snap.sharedWordIndex,
      startedAt: snap.startedAt ? new Date(snap.startedAt) : null,
      endedAt: snap.endedAt ? new Date(snap.endedAt) : null,
      participants: snap.participants.map((p) => ({
        id: p.id,
        playerId: p.playerId,
        username: p.username,
        score: p.score,
        result: p.result,
        isBot: p.isBot ?? false,
        isYou: viewerPlayerId ? p.playerId === viewerPlayerId : false,
      })),
      isParticipant: viewerPlayerId
        ? snap.participants.some((p) => p.playerId === viewerPlayerId)
        : false,
      snapshotRev: snap.rev,
    };
  }

  private async syncWordMatchSnapshot(sessionId: string): Promise<void> {
    await this.liveRedis.refreshSnapshot(sessionId);
  }

  private async assertWordMatchIfSnapshotRev(
    sessionId: string,
    expected: number | undefined,
  ): Promise<void> {
    if (expected === undefined) return;
    const snap = await this.liveRedis.readSnapshot(sessionId);
    if (!snap) return;
    if (snap.rev !== expected) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'snapshot revision mismatch',
        currentRev: snap.rev,
      });
    }
  }

  /**
   * Returns the venue this player is gated to for a given word session:
   *   1. `config.playerVenueIds[playerId]` (cross-venue queue match — own venue)
   *   2. `session.venueId` (legacy single-venue room / rematch)
   * Returns null for purely-global rooms (subscriber-only, no venue).
   */
  private effectivePlayerVenueId(
    config: WordMatchConfig | null | undefined,
    sessionVenueId: string | null | undefined,
    playerId: string,
  ): string | null {
    const own = config?.playerVenueIds?.[playerId];
    if (own && own.trim()) return own.trim();
    return sessionVenueId ?? null;
  }

  /** When `sessionVenueId` is set, `latitude`/`longitude` must place the user in that venue’s geofence. */
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
      throw new ForbiddenException('Venue word play requires your current location (lat/lng)');
    }
    await this.venues.assertCoordinatesAllowedForGuestVenue(
      sessionVenueId,
      latitude!,
      longitude!,
    );
  }

  /**
   * Play budget is only enforced on the first deck fetch that counts this match;
   * later polls must not fail after stamina hits 0 mid-match.
   */
  private async assertVenuePlayBudgetUnlessWordMatchAlreadyCounted(
    playerId: string,
    venueId: string,
    sessionId: string,
  ): Promise<void> {
    if (await this.subscriptions.isActiveSubscriber(playerId)) return;
    const existing = await this.prisma.playerVenuePlayCountedGame.findUnique({
      where: {
        playerId_gameSessionId_kind: {
          playerId,
          gameSessionId: sessionId,
          kind: 'word_match',
        },
      },
    });
    if (existing) return;
    await this.venuePlayBudget.assertHasRemainingVenuePlayBudget(playerId, venueId);
  }

  private pushSessionRefresh(sessionId: string, meta?: Partial<WordMatchRefreshPayload>) {
    this.events.emit(WORD_MATCH_REFRESH_EVENT, { sessionId, ...meta });
  }

  private async finishCoopAllLoss(
    tx: Prisma.TransactionClient,
    sessionId: string,
    participants: { id: string; playerId: string | null; leftAt: Date | null }[],
  ) {
    await tx.gameSession.update({
      where: { id: sessionId },
      data: { status: GameSessionStatus.FINISHED, endedAt: new Date() },
    });
    for (const p of participants.filter(isParticipantActive)) {
      await tx.gameParticipant.update({
        where: { id: p.id },
        data: { result: GameParticipantResult.LOSS },
      });
    }
  }

  private async newInviteCode(
    db: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 30; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)]!;
      }
      const exists = await db.gameSession.findUnique({
        where: { inviteCode: code },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('could not allocate invite code');
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

  async create(email: string, dto: CreateWordMatchDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const partyId = dto.partyId?.trim() || null;
    await this.assertPartyMemberIfNeeded(partyId, player.id);
    const vId = dto.venueId?.trim();
    if (vId) {
      await this.assertAtVenueIfNeeded(vId, dto.latitude, dto.longitude);
    } else {
      const subOk = await this.subscriptions.isActiveSubscriber(player.id);
      if (!subOk) {
        throw new ForbiddenException('Word rooms without a venue require an active subscription');
      }
    }
    const deck = await this.wordRepo.findRandomSessionDeck({
      language: dto.language,
      category: dto.category,
      count: dto.wordCount,
      difficulty: dto.difficulty,
    });
    if (deck.length === 0) {
      throw new BadRequestException('no words for this language/category');
    }
    if (dto.ranked && dto.mode !== 'versus') {
      throw new BadRequestException('ranked is only available in versus mode');
    }
    const wordIds = deck.map((w) => w.id);
    const inviteCode = await this.newInviteCode();
    const config: WordMatchConfig = {
      wordGameMode: dto.mode,
      difficulty: dto.difficulty,
      wordIds,
      hostPlayerId: player.id,
      category: dto.category ?? null,
      ...(dto.mode === 'versus' && dto.ranked ? { ranked: true } : {}),
    };

    const session = await this.prisma.gameSession.create({
      data: {
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.PENDING,
        inviteCode,
        venueId: vId || null,
        partyId,
        config: config as unknown as Prisma.InputJsonValue,
        wordSession: {
          create: {
            roundCount: wordIds.length,
            language: dto.language,
            sharedWordIndex: 0,
          },
        },
        participants: {
          create: {
            playerId: player.id,
            isBot: false,
            displayNameSnapshot: player.username,
          },
        },
      },
      include: { participants: true },
    });

    await this.syncWordMatchSnapshot(session.id);

    return {
      sessionId: session.id,
      inviteCode: session.inviteCode,
      mode: dto.mode,
      status: session.status,
      participantCount: session.participants.length,
    };
  }

  async joinByCode(
    email: string,
    dto: { inviteCode: string; latitude?: number; longitude?: number },
  ) {
    const player = await this.players.findOrCreateByEmail(email);
    const normalized = dto.inviteCode.trim().toUpperCase();
    const session = await this.prisma.gameSession.findFirst({
      where: {
        inviteCode: normalized,
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.PENDING,
      },
      include: { participants: true },
    });
    if (!session) throw new NotFoundException('match not found or already started');

    const config = session.config as unknown as WordMatchConfig | null;
    const max = config?.wordGameMode === 'versus' ? 4 : 6;
    const active = session.participants.filter(isParticipantActive);
    if (active.length >= max) {
      throw new BadRequestException('match is full');
    }
    if (session.participants.some((p) => p.playerId === player.id && !p.leftAt)) {
      return this.getStateForViewer(player.id, session.id);
    }

    if (session.venueId) {
      await this.assertAtVenueIfNeeded(session.venueId, dto.latitude, dto.longitude);
    } else {
      const subOk = await this.subscriptions.isActiveSubscriber(player.id);
      if (!subOk) {
        throw new ForbiddenException('This room is global — join requires an active subscription');
      }
    }

    const rejoin = session.participants.find((p) => p.playerId === player.id && p.leftAt);
    if (rejoin) {
      await this.prisma.gameParticipant.update({
        where: { id: rejoin.id },
        data: { leftAt: null },
      });
      await this.syncWordMatchSnapshot(session.id);
      this.pushSessionRefresh(session.id, { reason: 'join' });
      return this.getStateForViewer(player.id, session.id);
    }

    const alreadyThere = active.map((p) => p.playerId!).filter(Boolean);

    await this.prisma.gameParticipant.create({
      data: {
        sessionId: session.id,
        playerId: player.id,
        isBot: false,
        displayNameSnapshot: player.username,
      },
    });

    await this.syncWordMatchSnapshot(session.id);
    this.pushSessionRefresh(session.id, { reason: 'join' });

    void this.pushNotifications.sendToPlayers(
      alreadyThere,
      undefined,
      {
        title: 'Cafe Social',
        body: `${player.username} joined your word room`,
        data: {
          type: 'word_match_join',
          sessionId: session.id,
          venueId: session.venueId ?? '',
          pushCategory: 'match',
        },
      },
      { channel: 'match' },
    );

    return this.getStateForViewer(player.id, session.id);
  }

  async start(email: string, sessionId: string, ifSnapshotRev?: number) {
    await this.assertWordMatchIfSnapshotRev(sessionId, ifSnapshotRev);
    const player = await this.players.findOrCreateByEmail(email);
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true, wordSession: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    if (session.status !== GameSessionStatus.PENDING) {
      throw new BadRequestException('match already started or ended');
    }
    const config = session.config as unknown as WordMatchConfig;
    if (!config?.hostPlayerId || config.hostPlayerId !== player.id) {
      throw new ForbiddenException('only the host can start the match');
    }
    const activeHumans = session.participants.filter(
      (p) => !p.leftAt && Boolean(p.playerId) && !p.isBot,
    );
    if (activeHumans.length < 2) {
      throw new BadRequestException('need at least 2 players');
    }

    await this.activateWordMatchSession(sessionId);

    return { sessionId, status: GameSessionStatus.ACTIVE };
  }

  private async activateWordMatchSession(sessionId: string): Promise<void> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true, wordSession: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) return;
    if (session.status !== GameSessionStatus.PENDING) return;
    const config = session.config as unknown as WordMatchConfig;
    if (!config) return;

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: GameSessionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    // Emit one feed event per **distinct** venue represented in the match. For cross-venue
    // queue matches both venues see the "match started" entry; for legacy single-venue rooms
    // (or rematches) we fall back to `session.venueId`.
    const playerVenueIds = config.playerVenueIds ?? {};
    const partByPlayer = new Map(
      session.participants
        .filter((p) => p.playerId)
        .map((p) => [p.playerId as string, p]),
    );
    const venueToActor: Record<string, string> = {};
    for (const [pid, vid] of Object.entries(playerVenueIds)) {
      if (!vid) continue;
      if (venueToActor[vid]) continue;
      const part = partByPlayer.get(pid);
      venueToActor[vid] = part?.displayNameSnapshot ?? 'Player';
    }
    if (Object.keys(venueToActor).length === 0 && session.venueId) {
      const hostParticipant = session.participants.find((p) => p.playerId === config.hostPlayerId);
      venueToActor[session.venueId] = hostParticipant?.displayNameSnapshot ?? 'Player';
    }
    for (const [vid, name] of Object.entries(venueToActor)) {
      void this.venueFeed.recordWordMatchStarted(vid, name, config.wordGameMode);
    }

    await this.syncWordMatchSnapshot(sessionId);
    this.pushSessionRefresh(sessionId, { reason: 'start' });

    const participantIds = session.participants
      .filter(isParticipantActive)
      .map((p) => p.playerId!)
      .filter(Boolean);
    void this.pushNotifications.sendToPlayers(
      participantIds,
      undefined,
      {
        title: 'Cafe Social',
        body: 'Word match is starting — open the app to play!',
        data: {
          type: 'word_match_start',
          sessionId,
          venueId: session.venueId ?? '',
          pushCategory: 'match',
        },
      },
      { channel: 'match' },
    );
  }

  async getStateForViewer(playerId: string, sessionId: string) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    const isParticipant = session.participants.some(
      (p) => p.playerId === playerId && !p.leftAt,
    );
    if (!isParticipant) throw new ForbiddenException('not in this match');
    return this.getState(sessionId, playerId);
  }

  async getState(sessionId: string, viewerPlayerId?: string) {
    const cached = await this.liveRedis.readSnapshot(sessionId);
    if (cached) {
      return this.mapSnapshotToPublicState(cached, viewerPlayerId);
    }

    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: { include: { player: { select: { id: true, username: true } } } },
        wordSession: true,
      },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    const config = session.config as unknown as WordMatchConfig;
    const ws = session.wordSession;
    const payload = {
      sessionId: session.id,
      status: session.status,
      mode: config.wordGameMode,
      difficulty: config.difficulty,
      ranked: Boolean(config.ranked),
      venueId: session.venueId,
      playerVenueId:
        viewerPlayerId && config.playerVenueIds?.[viewerPlayerId]
          ? config.playerVenueIds[viewerPlayerId]
          : session.venueId,
      deckLanguage: ws?.language ?? 'en',
      deckCategory: config.category ?? null,
      hostPlayerId: config.hostPlayerId,
      inviteCode: session.inviteCode,
      targetWordCount: config.wordIds.length,
      sharedWordIndex: ws?.sharedWordIndex ?? 0,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      participants: session.participants.filter(isParticipantActive).map((p) => ({
        id: p.id,
        playerId: p.playerId,
        username: p.displayNameSnapshot ?? p.player?.username ?? 'Player',
        score: p.score,
        result: p.result,
        isBot: p.isBot,
        isYou: viewerPlayerId ? p.playerId === viewerPlayerId : false,
      })),
      isParticipant: viewerPlayerId
        ? session.participants.some((p) => p.playerId === viewerPlayerId && !p.leftAt)
        : false,
      snapshotRev: null as number | null,
    };
    void this.syncWordMatchSnapshot(sessionId);
    return payload;
  }

  private async ensureParticipant(sessionId: string, playerId: string) {
    const p = await this.prisma.gameParticipant.findFirst({
      where: { sessionId, playerId, leftAt: null },
    });
    if (!p) throw new ForbiddenException('not in this match');
    return p;
  }

  async getDeck(
    email: string,
    sessionId: string,
    latitude?: number,
    longitude?: number,
  ): Promise<{
    mode: 'coop' | 'versus';
    wordIndex: number;
    targetWordCount: number;
    currentWord: WordPublicHint | null;
    snapshotRev?: number | null;
  }> {
    const player = await this.players.findOrCreateByEmail(email);
    const snap = await this.liveRedis.readSnapshot(sessionId);

    if (
      snap &&
      snap.status === GameSessionStatus.ACTIVE &&
      snap.wordIds.length > 0
    ) {
      const self = snap.participants.find((p) => p.playerId === player.id);
      if (!self) {
        throw new ForbiddenException('not in this match');
      }
      // Cross-venue queue matches stamp each player's own venue on the snapshot.
      const playerVenueId =
        snap.playerVenueIds?.[player.id] && snap.playerVenueIds[player.id]!.trim()
          ? snap.playerVenueIds[player.id]!.trim()
          : snap.venueId;
      await this.assertAtVenueIfNeeded(playerVenueId, latitude, longitude);
      if (playerVenueId) {
        await this.assertVenuePlayBudgetUnlessWordMatchAlreadyCounted(
          player.id,
          playerVenueId,
          sessionId,
        );
        await this.venuePlayLimit.beginWordMatchDeck(player.id, playerVenueId, sessionId);
      }

      const mode = snap.mode;
      const wordIds = snap.wordIds;
      const wordIndex = mode === 'coop' ? snap.sharedWordIndex : self.score;

      if (wordIndex >= wordIds.length) {
        return {
          mode,
          wordIndex,
          targetWordCount: wordIds.length,
          currentWord: null,
          snapshotRev: snap.rev,
        };
      }

      const w = await this.prisma.word.findUnique({
        where: { id: wordIds[wordIndex]! },
      });
      if (!w) throw new BadRequestException('word missing');

      return {
        mode,
        wordIndex,
        targetWordCount: wordIds.length,
        currentWord: wordToPublicHints(w),
        snapshotRev: snap.rev,
      };
    }

    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { wordSession: true, participants: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('match is not active');
    }
    await this.ensureParticipant(sessionId, player.id);
    const config = session.config as unknown as WordMatchConfig;
    const playerVenueId = this.effectivePlayerVenueId(config, session.venueId, player.id);
    await this.assertAtVenueIfNeeded(playerVenueId, latitude, longitude);

    if (playerVenueId) {
      await this.assertVenuePlayBudgetUnlessWordMatchAlreadyCounted(
        player.id,
        playerVenueId,
        sessionId,
      );
      await this.venuePlayLimit.beginWordMatchDeck(player.id, playerVenueId, sessionId);
    }

    const ws = session.wordSession;
    if (!ws) throw new BadRequestException('invalid session');

    const mode = config.wordGameMode;
    const wordIndex =
      mode === 'coop'
        ? ws.sharedWordIndex
        : (session.participants.find((p) => p.playerId === player.id && !p.leftAt)?.score ?? 0);

    if (wordIndex >= config.wordIds.length) {
      return {
        mode,
        wordIndex,
        targetWordCount: config.wordIds.length,
        currentWord: null,
        snapshotRev: null,
      };
    }

    const w = await this.prisma.word.findUnique({
      where: { id: config.wordIds[wordIndex]! },
    });
    if (!w) throw new BadRequestException('word missing');

    void this.syncWordMatchSnapshot(sessionId);

    return {
      mode,
      wordIndex,
      targetWordCount: config.wordIds.length,
      currentWord: wordToPublicHints(w),
      snapshotRev: null,
    };
  }

  async coopGuess(email: string, sessionId: string, dto: CoopGuessDto, ifMatchHeader?: string) {
    await this.assertWordMatchIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const player = await this.players.findOrCreateByEmail(email);
    const part = await this.ensureParticipant(sessionId, player.id);

    const brief = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { venueId: true, config: true },
    });
    await this.assertAtVenueIfNeeded(
      this.effectivePlayerVenueId(brief?.config as unknown as WordMatchConfig | null, brief?.venueId, player.id),
      dto.latitude,
      dto.longitude,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        include: { wordSession: true, participants: true },
      });
      if (!session || session.status !== GameSessionStatus.ACTIVE || !session.wordSession) {
        throw new BadRequestException('match not active');
      }
      const config = session.config as unknown as WordMatchConfig;
      if (config.wordGameMode !== 'coop') {
        throw new BadRequestException('not a co-op match');
      }
      const idx = session.wordSession.sharedWordIndex;
      const wordIds = config.wordIds;
      if (idx >= wordIds.length) {
        return {
          done: true,
          correct: false,
          newIndex: idx,
          currentWord: null as WordPublicHint | null,
          perfectCoop: false,
        };
      }
      const word = await tx.word.findUnique({ where: { id: wordIds[idx] } });
      if (!word) throw new BadRequestException('word missing');

      const ok = normalizeGuess(dto.guess) === normalizeGuess(word.text);

      if (!ok) {
        await tx.wordParticipantStats.upsert({
          where: { participantId: part.id },
          create: { participantId: part.id, wrongAnswers: 1 },
          update: { wrongAnswers: { increment: 1 } },
        });
        return {
          done: false,
          correct: false,
          newIndex: idx,
          currentWord: wordToPublicHints(word),
          perfectCoop: false,
        };
      }

      await tx.wordParticipantStats.upsert({
        where: { participantId: part.id },
        create: { participantId: part.id, correctAnswers: 1 },
        update: { correctAnswers: { increment: 1 } },
      });

      const nextIdx = idx + 1;
      const perfectRun =
        session.wordSession.wordsSolvedCount + 1 === wordIds.length && nextIdx >= wordIds.length;
      await tx.wordSession.update({
        where: { sessionId },
        data: { sharedWordIndex: nextIdx, wordsSolvedCount: { increment: 1 } },
      });

      if (nextIdx >= wordIds.length) {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: {
            status: GameSessionStatus.FINISHED,
            endedAt: new Date(),
          },
        });
        for (const p of session.participants.filter(isParticipantActive)) {
          await tx.gameParticipant.update({
            where: { id: p.id },
            data: {
              result: perfectRun ? GameParticipantResult.WIN : GameParticipantResult.LOSS,
            },
          });
        }
        return {
          done: true,
          correct: true,
          newIndex: nextIdx,
          currentWord: null,
          perfectCoop: perfectRun,
        };
      }

      const nextW = await tx.word.findUnique({ where: { id: wordIds[nextIdx]! } });
      return {
        done: false,
        correct: true,
        newIndex: nextIdx,
        currentWord: nextW ? wordToPublicHints(nextW) : null,
        perfectCoop: false,
      };
    });

    await this.syncWordMatchSnapshot(sessionId);
    if (result.correct) {
      this.pushSessionRefresh(sessionId, { reason: 'coop_guess' });
    }
    if (result.done) {
      if (result.perfectCoop) {
        void this.gameXp.tryAwardSessionWinXp(sessionId);
      }
      this.recordVenueChallengesForSession(sessionId);
    }
    return result;
  }

  /** Skip current co-op word (e.g. timer). Perfect clear required for win XP. */
  async coopPass(email: string, sessionId: string, dto: MatchPassDto, ifMatchHeader?: string) {
    await this.assertWordMatchIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const player = await this.players.findOrCreateByEmail(email);
    const part = await this.ensureParticipant(sessionId, player.id);

    const brief = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { venueId: true, config: true },
    });
    await this.assertAtVenueIfNeeded(
      this.effectivePlayerVenueId(brief?.config as unknown as WordMatchConfig | null, brief?.venueId, player.id),
      dto.latitude,
      dto.longitude,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        include: { wordSession: true, participants: true },
      });
      if (!session || session.status !== GameSessionStatus.ACTIVE || !session.wordSession) {
        throw new BadRequestException('match not active');
      }
      const config = session.config as unknown as WordMatchConfig;
      if (config.wordGameMode !== 'coop') {
        throw new BadRequestException('not a co-op match');
      }
      const idx = session.wordSession.sharedWordIndex;
      const wordIds = config.wordIds;
      if (idx >= wordIds.length) {
        return { done: true, skipped: true, newIndex: idx, currentWord: null as WordPublicHint | null };
      }

      const word = await tx.word.findUnique({ where: { id: wordIds[idx] } });
      if (!word) throw new BadRequestException('word missing');

      await tx.wordParticipantStats.upsert({
        where: { participantId: part.id },
        create: { participantId: part.id, wrongAnswers: 1 },
        update: { wrongAnswers: { increment: 1 } },
      });

      const nextIdx = idx + 1;
      await tx.wordSession.update({
        where: { sessionId },
        data: { sharedWordIndex: nextIdx },
      });

      if (nextIdx >= wordIds.length) {
        await this.finishCoopAllLoss(tx, sessionId, session.participants);
        return { done: true, skipped: true, newIndex: nextIdx, currentWord: null };
      }

      const nextW = await tx.word.findUnique({ where: { id: wordIds[nextIdx]! } });
      return {
        done: false,
        skipped: true,
        newIndex: nextIdx,
        currentWord: nextW ? wordToPublicHints(nextW) : null,
      };
    });

    await this.syncWordMatchSnapshot(sessionId);
    this.pushSessionRefresh(sessionId, { reason: 'coop_pass' });
    return result;
  }

  /** Server validates the answer (same as co-op) so scores cannot be faked. */
  async versusGuess(email: string, sessionId: string, dto: CoopGuessDto, ifMatchHeader?: string) {
    await this.assertWordMatchIfSnapshotRev(
      sessionId,
      resolveIfSnapshotRev(ifMatchHeader, dto.ifSnapshotRev),
    );
    const player = await this.players.findOrCreateByEmail(email);
    const part = await this.ensureParticipant(sessionId, player.id);

    const brief = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { venueId: true, config: true },
    });
    await this.assertAtVenueIfNeeded(
      this.effectivePlayerVenueId(brief?.config as unknown as WordMatchConfig | null, brief?.venueId, player.id),
      dto.latitude,
      dto.longitude,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        include: { wordSession: true, participants: true },
      });
      if (!session || session.status !== GameSessionStatus.ACTIVE || !session.wordSession) {
        throw new BadRequestException('match not active');
      }
      const config = session.config as unknown as WordMatchConfig;
      if (config.wordGameMode !== 'versus') {
        throw new BadRequestException('not a versus match');
      }
      const target = config.wordIds.length;

      const partRow = session.participants.find((p) => p.id === part.id);
      if (!partRow?.playerId || partRow.leftAt) {
        throw new ForbiddenException('not in this match');
      }

      const idx = partRow.score;
      if (idx >= target) {
        throw new BadRequestException('already finished your deck');
      }

      const word = await tx.word.findUnique({ where: { id: config.wordIds[idx] } });
      if (!word) throw new BadRequestException('word missing');

      const ok = normalizeGuess(dto.guess) === normalizeGuess(word.text);

      if (!ok) {
        await tx.wordParticipantStats.upsert({
          where: { participantId: part.id },
          create: { participantId: part.id, wrongAnswers: 1 },
          update: { wrongAnswers: { increment: 1 } },
        });
        return {
          correct: false,
          finished: false,
          yourScore: partRow.score,
          winner: false,
          currentWord: wordToPublicHints(word),
        };
      }

      const updated = await tx.gameParticipant.update({
        where: { id: part.id },
        data: { score: { increment: 1 } },
      });

      await tx.wordParticipantStats.upsert({
        where: { participantId: part.id },
        create: { participantId: part.id, correctAnswers: 1 },
        update: { correctAnswers: { increment: 1 } },
      });

      if (updated.score >= target) {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { status: GameSessionStatus.FINISHED, endedAt: new Date() },
        });
        const stillIn = session.participants.filter(isParticipantActive);
        for (const p of stillIn) {
          const isWinner = p.id === part.id;
          await tx.gameParticipant.update({
            where: { id: p.id },
            data: {
              result: isWinner
                ? GameParticipantResult.WIN
                : GameParticipantResult.LOSS,
              placement: isWinner ? 1 : 2,
            },
          });
        }
        return {
          correct: true,
          finished: true,
          yourScore: updated.score,
          winner: true,
          currentWord: null as WordPublicHint | null,
        };
      }

      const nextW = await tx.word.findUnique({ where: { id: config.wordIds[updated.score]! } });
      return {
        correct: true,
        finished: false,
        yourScore: updated.score,
        winner: false,
        currentWord: nextW ? wordToPublicHints(nextW) : null,
      };
    });

    await this.syncWordMatchSnapshot(sessionId);
    if (result.correct) {
      this.pushSessionRefresh(sessionId, {
        reason: 'versus_guess',
        participantId: part.id,
        score: result.yourScore,
      });
    }
    if (result.finished) {
      void this.gameXp.tryAwardSessionWinXp(sessionId);
      this.recordVenueChallengesForSession(sessionId);
    }
    return result;
  }

  async leave(email: string, sessionId: string, ifSnapshotRev?: number) {
    await this.assertWordMatchIfSnapshotRev(sessionId, ifSnapshotRev);
    const player = await this.players.findOrCreateByEmail(email);
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true, wordSession: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    const part = session.participants.find((p) => p.playerId === player.id && !p.leftAt);
    if (!part) throw new NotFoundException('not in this match');

    if (session.status === GameSessionStatus.FINISHED) {
      throw new BadRequestException('match already finished');
    }

    const config = session.config as unknown as WordMatchConfig;

    if (session.status === GameSessionStatus.PENDING) {
      await this.prisma.gameParticipant.update({
        where: { id: part.id },
        data: { leftAt: new Date() },
      });
      const after = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });
      const active = after!.participants.filter(isParticipantActive);
      if (active.length === 0) {
        await this.prisma.gameSession.update({
          where: { id: sessionId },
          data: { status: GameSessionStatus.CANCELLED, endedAt: new Date() },
        });
      } else if (config.hostPlayerId === player.id) {
        const nextHost = active[0]!.playerId!;
        await this.prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            config: {
              ...config,
              hostPlayerId: nextHost,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
      await this.syncWordMatchSnapshot(sessionId);
      this.pushSessionRefresh(sessionId, { reason: 'leave' });
      return { ok: true as const };
    }

    if (session.status === GameSessionStatus.ACTIVE) {
      await this.prisma.gameParticipant.update({
        where: { id: part.id },
        data: { leftAt: new Date(), result: GameParticipantResult.LOSS },
      });

      const fresh = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });
      if (
        fresh &&
        fresh.status === GameSessionStatus.ACTIVE &&
        config.wordGameMode === 'versus'
      ) {
        const stillActive = fresh.participants.filter(isParticipantActive);
        if (stillActive.length === 1) {
          const sole = stillActive[0]!;
          await this.prisma.gameSession.update({
            where: { id: sessionId },
            data: { status: GameSessionStatus.FINISHED, endedAt: new Date() },
          });
          await this.prisma.gameParticipant.update({
            where: { id: sole.id },
            data: { result: GameParticipantResult.WIN, placement: 1 },
          });
          void this.gameXp.tryAwardSessionWinXp(sessionId);
        } else if (stillActive.length === 0) {
          await this.prisma.gameSession.update({
            where: { id: sessionId },
            data: { status: GameSessionStatus.CANCELLED, endedAt: new Date() },
          });
        }
      }

      await this.syncWordMatchSnapshot(sessionId);
      this.pushSessionRefresh(sessionId, { reason: 'leave' });
      return { ok: true as const };
    }

    throw new BadRequestException('cannot leave this match');
  }

  async rematch(email: string, sessionId: string, ifSnapshotRev?: number) {
    await this.assertWordMatchIfSnapshotRev(sessionId, ifSnapshotRev);
    const player = await this.players.findOrCreateByEmail(email);
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { participants: true, wordSession: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    if (session.status !== GameSessionStatus.FINISHED) {
      throw new BadRequestException('can only rematch after a finished game');
    }
    const finisher = session.participants.some((p) => p.playerId === player.id && !p.leftAt);
    if (!finisher) throw new ForbiddenException('not in this match');

    const config = session.config as unknown as WordMatchConfig;
    const ws = session.wordSession;
    if (!ws) throw new BadRequestException('invalid session');

    const deck = await this.wordRepo.findRandomSessionDeck({
      language: ws.language,
      category: config.category ?? undefined,
      count: config.wordIds.length,
      difficulty: config.difficulty,
    });
    if (deck.length === 0) {
      throw new BadRequestException('no words for this language/category');
    }

    const wordIds = deck.map((w) => w.id);
    const inviteCode = await this.newInviteCode();
    const playerIds = session.participants
      .filter((p) => p.playerId && !p.leftAt)
      .map((p) => p.playerId!);

    let hostId = config.hostPlayerId;
    if (!playerIds.includes(hostId)) {
      hostId = playerIds[0]!;
    }

    const newConfig: WordMatchConfig = {
      ...config,
      wordIds,
      hostPlayerId: hostId,
    };

    const newSession = await this.prisma.gameSession.create({
      data: {
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.PENDING,
        inviteCode,
        venueId: session.venueId,
        config: newConfig as unknown as Prisma.InputJsonValue,
        wordSession: {
          create: {
            roundCount: wordIds.length,
            language: ws.language,
            sharedWordIndex: 0,
          },
        },
        participants: {
          create: playerIds.map((pid) => {
            const snap =
              session.participants.find((x) => x.playerId === pid)?.displayNameSnapshot ??
              'Player';
            return {
              playerId: pid,
              isBot: false,
              displayNameSnapshot: snap,
            };
          }),
        },
      },
      include: { participants: true },
    });

    await this.liveRedis.removeSnapshot(sessionId);
    await this.syncWordMatchSnapshot(newSession.id);

    return {
      sessionId: newSession.id,
      inviteCode: newSession.inviteCode,
      mode: newConfig.wordGameMode,
      status: newSession.status,
      participantCount: newSession.participants.filter(isParticipantActive).length,
    };
  }

  async enqueueVenueWordMatch(email: string, dto: EnqueueWordMatchQueueDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const partyId = dto.partyId?.trim() || null;
    await this.assertPartyMemberIfNeeded(partyId, player.id);
    const rawVenueId = dto.venueId?.trim() || null;

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

    if (dto.ranked && dto.mode !== 'versus') {
      throw new BadRequestException('ranked is only available in versus mode');
    }
    const ranked = dto.mode === 'versus' && Boolean(dto.ranked);
    const modeEnum =
      dto.mode === 'coop' ? WordMatchQueueMode.COOP : WordMatchQueueMode.VERSUS;

    await this.prisma.wordMatchQueueEntry.updateMany({
      where: { playerId: player.id, status: WordMatchQueueStatus.WAITING },
      data: { status: WordMatchQueueStatus.CANCELLED },
    });

    await this.prisma.wordMatchQueueEntry.create({
      data: {
        venueId: vId,
        playerId: player.id,
        partyId,
        mode: modeEnum,
        difficulty: dto.difficulty,
        wordCount: dto.wordCount,
        language: dto.language,
        category: dto.category ?? null,
        ranked,
      },
    });

    await this.tryMatchWordQueueBucket(
      modeEnum,
      dto.difficulty,
      dto.wordCount,
      dto.language,
      dto.category ?? null,
      ranked,
    );

    return this.getVenueQueueStatusForPlayer(player.id, vId);
  }

  async leaveVenueWordQueue(email: string, venueId?: string | null): Promise<{ ok: true }> {
    const player = await this.players.findOrCreateByEmail(email);
    const v = venueId?.trim() || null;
    await this.prisma.wordMatchQueueEntry.updateMany({
      where: {
        playerId: player.id,
        // When venueId omitted, leave whichever queue the player is currently in
        // (single in-flight WAITING row enforced at enqueue time).
        ...(v ? { venueId: v } : {}),
        status: WordMatchQueueStatus.WAITING,
      },
      data: { status: WordMatchQueueStatus.CANCELLED },
    });
    return { ok: true as const };
  }

  async getVenueQueueStatus(email: string, venueId?: string | null) {
    const player = await this.players.findOrCreateByEmail(email);
    return this.getVenueQueueStatusForPlayer(player.id, venueId?.trim() || null);
  }

  private async getVenueQueueStatusForPlayer(playerId: string, _venueId: string | null) {
    const row = await this.prisma.wordMatchQueueEntry.findFirst({
      where: {
        playerId,
        status: { in: [WordMatchQueueStatus.WAITING, WordMatchQueueStatus.MATCHED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return { status: 'idle' as const };
    if (row.status === WordMatchQueueStatus.MATCHED && row.matchedSessionId) {
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
    // Position is global across all venues — players can be paired with anyone in the same rules bucket.
    const waitingAhead = await this.prisma.wordMatchQueueEntry.count({
      where: {
        mode: row.mode,
        difficulty: row.difficulty,
        wordCount: row.wordCount,
        language: row.language,
        category: row.category,
        ranked: row.ranked,
        partyId: row.partyId,
        status: WordMatchQueueStatus.WAITING,
        createdAt: { lt: row.createdAt },
      },
    });
    return { status: 'waiting' as const, position: waitingAhead + 1 };
  }

  /** Casual-only queue bot-fill: pair one WAITING row with a bot opponent and activate the session. */
  async tryFillWordQueueWithBot(queueEntryId: string): Promise<string | null> {
    let createdSessionId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.wordMatchQueueEntry.findUnique({
        where: { id: queueEntryId },
      });
      if (!row || row.status !== WordMatchQueueStatus.WAITING || row.ranked || row.partyId) {
        return;
      }

      const pa = await tx.player.findUnique({
        where: { id: row.playerId },
        select: { username: true },
      });
      if (!pa) return;

      const deck = await this.wordRepo.findRandomSessionDeck({
        language: row.language,
        category: row.category ?? undefined,
        count: row.wordCount,
        difficulty: row.difficulty,
      });
      if (deck.length === 0) return;

      const wordIds = deck.map((w) => w.id);
      const inviteCode = await this.newInviteCode(tx);
      const wordGameMode: 'coop' | 'versus' =
        row.mode === WordMatchQueueMode.COOP ? 'coop' : 'versus';
      const playerVenueIds: Record<string, string> = {};
      if (row.venueId) playerVenueIds[row.playerId] = row.venueId;

      const config: WordMatchConfig = {
        wordGameMode,
        difficulty: row.difficulty,
        wordIds,
        hostPlayerId: row.playerId,
        category: row.category ?? null,
        playerVenueIds,
      };

      const botDisplayName = 'Café Bot';
      const session = await tx.gameSession.create({
        data: {
          gameType: GameType.WORD_GAME,
          status: GameSessionStatus.PENDING,
          inviteCode,
          venueId: row.venueId ?? null,
          config: config as unknown as Prisma.InputJsonValue,
          wordSession: {
            create: {
              roundCount: wordIds.length,
              language: row.language,
              sharedWordIndex: 0,
            },
          },
          participants: {
            create: [
              {
                playerId: row.playerId,
                isBot: false,
                displayNameSnapshot: pa.username,
              },
              {
                playerId: null,
                isBot: true,
                botName: botDisplayName,
                displayNameSnapshot: botDisplayName,
              },
            ],
          },
        },
      });

      const upd = await tx.wordMatchQueueEntry.updateMany({
        where: {
          id: row.id,
          status: WordMatchQueueStatus.WAITING,
        },
        data: {
          status: WordMatchQueueStatus.MATCHED,
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
      await this.activateWordMatchSession(createdSessionId);
    }
    return createdSessionId;
  }

  /**
   * Queue bot driver — co-op: correct guess (exact word) or pass current word.
   * No auth / venue checks (server-side bot only).
   */
  async executeWordMatchBotCoopTurn(
    sessionId: string,
    botParticipantId: string,
    kind: 'correct' | 'pass',
  ): Promise<{ done: boolean; sessionFinished?: boolean }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        include: { wordSession: true, participants: true },
      });
      if (!session || session.status !== GameSessionStatus.ACTIVE || !session.wordSession) {
        throw new BadRequestException('match not active');
      }
      const config = session.config as unknown as WordMatchConfig;
      if (config.wordGameMode !== 'coop') {
        throw new BadRequestException('not a co-op match');
      }
      const botPart = session.participants.find((p) => p.id === botParticipantId);
      if (!botPart?.isBot || botPart.leftAt) {
        throw new ForbiddenException('invalid bot participant');
      }

      const part = botPart;

      if (kind === 'correct') {
        const idx = session.wordSession.sharedWordIndex;
        const wordIds = config.wordIds;
        if (idx >= wordIds.length) {
          return { done: true, sessionFinished: false, perfectCoop: false };
        }
        const word = await tx.word.findUnique({ where: { id: wordIds[idx]! } });
        if (!word) throw new BadRequestException('word missing');

        await tx.wordParticipantStats.upsert({
          where: { participantId: part.id },
          create: { participantId: part.id, correctAnswers: 1 },
          update: { correctAnswers: { increment: 1 } },
        });

        const nextIdx = idx + 1;
        const perfectRun =
          session.wordSession.wordsSolvedCount + 1 === wordIds.length &&
          nextIdx >= wordIds.length;
        await tx.wordSession.update({
          where: { sessionId },
          data: { sharedWordIndex: nextIdx, wordsSolvedCount: { increment: 1 } },
        });

        if (nextIdx >= wordIds.length) {
          await tx.gameSession.update({
            where: { id: sessionId },
            data: {
              status: GameSessionStatus.FINISHED,
              endedAt: new Date(),
            },
          });
          for (const p of session.participants.filter(isParticipantActive)) {
            await tx.gameParticipant.update({
              where: { id: p.id },
              data: {
                result: perfectRun ? GameParticipantResult.WIN : GameParticipantResult.LOSS,
              },
            });
          }
          return { done: true, sessionFinished: true, perfectCoop: perfectRun };
        }

        return { done: false, sessionFinished: false, perfectCoop: false };
      }

      // pass
      const idx = session.wordSession.sharedWordIndex;
      const wordIds = config.wordIds;
      if (idx >= wordIds.length) {
        return { done: true, sessionFinished: false, perfectCoop: false };
      }

      const word = await tx.word.findUnique({ where: { id: wordIds[idx]! } });
      if (!word) throw new BadRequestException('word missing');

      await tx.wordParticipantStats.upsert({
        where: { participantId: part.id },
        create: { participantId: part.id, wrongAnswers: 1 },
        update: { wrongAnswers: { increment: 1 } },
      });

      const nextIdx = idx + 1;
      await tx.wordSession.update({
        where: { sessionId },
        data: { sharedWordIndex: nextIdx },
      });

      if (nextIdx >= wordIds.length) {
        await this.finishCoopAllLoss(tx, sessionId, session.participants);
        return { done: true, sessionFinished: true, perfectCoop: false };
      }

      return { done: false, sessionFinished: false, perfectCoop: false };
    });

    await this.syncWordMatchSnapshot(sessionId);
    if (kind === 'correct') {
      this.pushSessionRefresh(sessionId, { reason: 'coop_guess' });
    } else {
      this.pushSessionRefresh(sessionId, { reason: 'coop_pass' });
    }
    if (result.perfectCoop) {
      void this.gameXp.tryAwardSessionWinXp(sessionId);
    }
    return { done: result.done, sessionFinished: result.sessionFinished };
  }

  /**
   * Queue bot driver — versus: correct or wrong guess for the bot's current word.
   */
  async executeWordMatchBotVersusTurn(
    sessionId: string,
    botParticipantId: string,
    kind: 'correct' | 'wrong',
  ): Promise<{ finished: boolean }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: sessionId },
        include: { wordSession: true, participants: true },
      });
      if (!session || session.status !== GameSessionStatus.ACTIVE || !session.wordSession) {
        throw new BadRequestException('match not active');
      }
      const config = session.config as unknown as WordMatchConfig;
      if (config.wordGameMode !== 'versus') {
        throw new BadRequestException('not a versus match');
      }
      const target = config.wordIds.length;

      const partRow = session.participants.find((p) => p.id === botParticipantId);
      if (!partRow?.isBot || partRow.leftAt) {
        throw new ForbiddenException('invalid bot participant');
      }

      const idx = partRow.score;
      if (idx >= target) {
        return { finished: true };
      }

      const word = await tx.word.findUnique({ where: { id: config.wordIds[idx]! } });
      if (!word) throw new BadRequestException('word missing');

      if (kind === 'wrong') {
        await tx.wordParticipantStats.upsert({
          where: { participantId: partRow.id },
          create: { participantId: partRow.id, wrongAnswers: 1 },
          update: { wrongAnswers: { increment: 1 } },
        });
        return { finished: false };
      }

      const updated = await tx.gameParticipant.update({
        where: { id: partRow.id },
        data: { score: { increment: 1 } },
      });

      await tx.wordParticipantStats.upsert({
        where: { participantId: partRow.id },
        create: { participantId: partRow.id, correctAnswers: 1 },
        update: { correctAnswers: { increment: 1 } },
      });

      if (updated.score >= target) {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { status: GameSessionStatus.FINISHED, endedAt: new Date() },
        });
        const stillIn = session.participants.filter(isParticipantActive);
        for (const p of stillIn) {
          const isWinner = p.id === partRow.id;
          await tx.gameParticipant.update({
            where: { id: p.id },
            data: {
              result: isWinner ? GameParticipantResult.WIN : GameParticipantResult.LOSS,
              placement: isWinner ? 1 : 2,
            },
          });
        }
        return { finished: true };
      }

      return { finished: false };
    });

    await this.syncWordMatchSnapshot(sessionId);
    if (kind === 'correct') {
      const part = await this.prisma.gameParticipant.findUnique({
        where: { id: botParticipantId },
      });
      if (part) {
        this.pushSessionRefresh(sessionId, {
          reason: 'versus_guess',
          participantId: part.id,
          score: part.score,
        });
      }
    }
    if (result.finished) {
      void this.gameXp.tryAwardSessionWinXp(sessionId);
      this.recordVenueChallengesForSession(sessionId);
    }
    return result;
  }

  private async tryMatchWordQueueBucket(
    mode: WordMatchQueueMode,
    difficulty: string,
    wordCount: number,
    language: string,
    category: WordCategory | null,
    ranked: boolean,
  ): Promise<void> {
    let createdSessionId: string | null = null;
    await this.prisma.$transaction(async (tx) => {
      // Cross-venue pairing: bucket is rules-based only. Each player is gated to their own
      // venue separately via `playerVenueIds` stamped onto the session config below.
      const anchor = await tx.wordMatchQueueEntry.findFirst({
        where: {
          mode,
          difficulty,
          wordCount,
          language,
          category: category === null ? null : category,
          ranked,
          status: WordMatchQueueStatus.WAITING,
        },
        orderBy: { createdAt: 'asc' },
        select: { partyId: true },
      });
      if (!anchor) return;

      const pair = await tx.wordMatchQueueEntry.findMany({
        where: {
          mode,
          difficulty,
          wordCount,
          language,
          category: category === null ? null : category,
          ranked,
          partyId: anchor.partyId,
          status: WordMatchQueueStatus.WAITING,
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

      const wordGameMode: 'coop' | 'versus' = mode === WordMatchQueueMode.COOP ? 'coop' : 'versus';
      const deck = await this.wordRepo.findRandomSessionDeck({
        language,
        category: category ?? undefined,
        count: wordCount,
        difficulty,
      });
      if (deck.length === 0) return;

      const wordIds = deck.map((w) => w.id);
      const inviteCode = await this.newInviteCode(tx);
      const playerVenueIds: Record<string, string> = {};
      if (a.venueId) playerVenueIds[a.playerId] = a.venueId;
      if (b.venueId) playerVenueIds[b.playerId] = b.venueId;
      const config: WordMatchConfig = {
        wordGameMode,
        difficulty,
        wordIds,
        hostPlayerId: a.playerId,
        category: category ?? null,
        playerVenueIds,
        ...(wordGameMode === 'versus' && ranked ? { ranked: true } : {}),
      };

      const session = await tx.gameSession.create({
        data: {
          gameType: GameType.WORD_GAME,
          status: GameSessionStatus.PENDING,
          inviteCode,
          // Host's venue (or null when host is a subscriber queueing from outside any venue).
          // Per-player gating uses each participant's own venue from `playerVenueIds`.
          venueId: a.venueId ?? null,
          partyId: a.partyId ?? null,
          config: config as unknown as Prisma.InputJsonValue,
          wordSession: {
            create: {
              roundCount: wordIds.length,
              language,
              sharedWordIndex: 0,
            },
          },
          participants: {
            create: [
              {
                playerId: a.playerId,
                isBot: false,
                displayNameSnapshot: pa.username,
              },
              {
                playerId: b.playerId,
                isBot: false,
                displayNameSnapshot: pb.username,
              },
            ],
          },
        },
      });

      const upd = await tx.wordMatchQueueEntry.updateMany({
        where: {
          id: { in: [a.id, b.id] },
          status: WordMatchQueueStatus.WAITING,
        },
        data: {
          status: WordMatchQueueStatus.MATCHED,
          matchedSessionId: session.id,
        },
      });
      if (upd.count !== 2) {
        throw new Error('queue match race: abort transaction');
      }
      createdSessionId = session.id;
    });

    if (createdSessionId) {
      await this.activateWordMatchSession(createdSessionId);
    }
  }

  private recordVenueChallengesForSession(sessionId: string): void {
    void (async () => {
      const session = await this.prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });
      if (!session || session.status !== GameSessionStatus.FINISHED) return;
      const config = session.config as unknown as WordMatchConfig;
      const playerVenueIds = config.playerVenueIds ?? {};
      for (const p of session.participants) {
        if (!p.playerId || p.isBot) continue;
        const venueId = playerVenueIds[p.playerId] ?? session.venueId;
        if (!venueId) continue;
        const countsAsWin = p.result === GameParticipantResult.WIN;
        await this.challenges.bumpActiveChallengesForPlayerAtVenue({
          playerId: p.playerId,
          venueId,
          trustVenuePresence: true,
          activityAtVenue: true,
          countsAsWin,
          source: ChallengeAutoProgressSource.WORD_MATCH,
        });
      }
    })();
  }
}
