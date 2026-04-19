import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  GameParticipantResult,
  GameSessionStatus,
  GameType,
  type Prisma,
  type WordCategory,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { WordRepository } from './word.repository';
import type { CreateWordMatchDto } from './dto/create-word-match.dto';
import type { CoopGuessDto } from './dto/coop-guess.dto';
import { WORD_MATCH_REFRESH_EVENT, type WordMatchRefreshPayload } from './word-match.gateway';
import { wordToPublicHints, type WordPublicHint } from './word-hint.util';
import { PushService } from '../push/push.service';
import { VenueFeedService } from '../venue-feed/venue-feed.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { VenueService } from '../venue/venue.service';
import { normalizeGuess } from './word-match.util';
import { GameXpAwardService } from '../stats/game-xp-award.service';

export type WordMatchConfig = {
  wordGameMode: 'coop' | 'versus';
  difficulty: string;
  wordIds: string[];
  hostPlayerId: string;
  category?: WordCategory | null;
};

function isParticipantActive(p: { playerId: string | null; leftAt: Date | null }): boolean {
  return Boolean(p.playerId && !p.leftAt);
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
    private readonly gameXp: GameXpAwardService,
  ) {}

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

  private pushSessionRefresh(sessionId: string, meta?: Partial<WordMatchRefreshPayload>) {
    this.events.emit(WORD_MATCH_REFRESH_EVENT, { sessionId, ...meta });
  }

  private async newInviteCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 30; attempt++) {
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)]!;
      }
      const exists = await this.prisma.gameSession.findUnique({
        where: { inviteCode: code },
      });
      if (!exists) return code;
    }
    throw new BadRequestException('could not allocate invite code');
  }

  async create(email: string, dto: CreateWordMatchDto) {
    const player = await this.players.findOrCreateByEmail(email);
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
    const wordIds = deck.map((w) => w.id);
    const inviteCode = await this.newInviteCode();
    const config: WordMatchConfig = {
      wordGameMode: dto.mode,
      difficulty: dto.difficulty,
      wordIds,
      hostPlayerId: player.id,
      category: dto.category ?? null,
    };

    const session = await this.prisma.gameSession.create({
      data: {
        gameType: GameType.WORD_GAME,
        status: GameSessionStatus.PENDING,
        inviteCode,
        venueId: vId || null,
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

  async start(email: string, sessionId: string) {
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
    const activeHumans = session.participants.filter(isParticipantActive);
    if (activeHumans.length < 2) {
      throw new BadRequestException('need at least 2 players');
    }

    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: GameSessionStatus.ACTIVE,
        startedAt: new Date(),
      },
    });

    if (session.venueId) {
      const hostParticipant = session.participants.find((p) => p.playerId === config.hostPlayerId);
      const name = hostParticipant?.displayNameSnapshot ?? 'Player';
      void this.venueFeed.recordWordMatchStarted(session.venueId, name, config.wordGameMode);
    }

    this.pushSessionRefresh(sessionId, { reason: 'start' });

    const participantIds = activeHumans.map((p) => p.playerId!).filter(Boolean);
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

    return { sessionId, status: GameSessionStatus.ACTIVE };
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
    return {
      sessionId: session.id,
      status: session.status,
      mode: config.wordGameMode,
      difficulty: config.difficulty,
      venueId: session.venueId,
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
        isYou: viewerPlayerId ? p.playerId === viewerPlayerId : false,
      })),
      isParticipant: viewerPlayerId
        ? session.participants.some((p) => p.playerId === viewerPlayerId && !p.leftAt)
        : false,
    };
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
  }> {
    const player = await this.players.findOrCreateByEmail(email);
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
    await this.assertAtVenueIfNeeded(session.venueId, latitude, longitude);

    if (session.venueId) {
      await this.venuePlayLimit.beginWordMatchDeck(player.id, session.venueId, sessionId);
    }

    const config = session.config as unknown as WordMatchConfig;
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
      };
    }

    const w = await this.prisma.word.findUnique({
      where: { id: config.wordIds[wordIndex]! },
    });
    if (!w) throw new BadRequestException('word missing');

    return {
      mode,
      wordIndex,
      targetWordCount: config.wordIds.length,
      currentWord: wordToPublicHints(w),
    };
  }

  async coopGuess(email: string, sessionId: string, dto: CoopGuessDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const part = await this.ensureParticipant(sessionId, player.id);

    const brief = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { venueId: true },
    });
    await this.assertAtVenueIfNeeded(brief?.venueId, dto.latitude, dto.longitude);

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
        return { done: true, correct: false, newIndex: idx, currentWord: null as WordPublicHint | null };
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
        return { done: false, correct: false, newIndex: idx, currentWord: wordToPublicHints(word) };
      }

      await tx.wordParticipantStats.upsert({
        where: { participantId: part.id },
        create: { participantId: part.id, correctAnswers: 1 },
        update: { correctAnswers: { increment: 1 } },
      });

      const nextIdx = idx + 1;
      await tx.wordSession.update({
        where: { sessionId },
        data: { sharedWordIndex: nextIdx },
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
          if (!p.playerId) continue;
          await tx.gameParticipant.update({
            where: { id: p.id },
            data: { result: GameParticipantResult.WIN },
          });
        }
        return { done: true, correct: true, newIndex: nextIdx, currentWord: null };
      }

      const nextW = await tx.word.findUnique({ where: { id: wordIds[nextIdx]! } });
      return {
        done: false,
        correct: true,
        newIndex: nextIdx,
        currentWord: nextW ? wordToPublicHints(nextW) : null,
      };
    });

    if (result.correct) {
      this.pushSessionRefresh(sessionId, { reason: 'coop_guess' });
    }
    if (result.done && result.correct) {
      void this.gameXp.tryAwardSessionWinXp(sessionId);
    }
    return result;
  }

  /** Server validates the answer (same as co-op) so scores cannot be faked. */
  async versusGuess(email: string, sessionId: string, dto: CoopGuessDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const part = await this.ensureParticipant(sessionId, player.id);

    const brief = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { venueId: true },
    });
    await this.assertAtVenueIfNeeded(brief?.venueId, dto.latitude, dto.longitude);

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
          if (!p.playerId) continue;
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

    if (result.correct) {
      this.pushSessionRefresh(sessionId, {
        reason: 'versus_guess',
        participantId: part.id,
        score: result.yourScore,
      });
    }
    if (result.finished) {
      void this.gameXp.tryAwardSessionWinXp(sessionId);
    }
    return result;
  }

  async leave(email: string, sessionId: string) {
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

      this.pushSessionRefresh(sessionId, { reason: 'leave' });
      return { ok: true as const };
    }

    throw new BadRequestException('cannot leave this match');
  }

  async rematch(email: string, sessionId: string) {
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

    return {
      sessionId: newSession.id,
      inviteCode: newSession.inviteCode,
      mode: newConfig.wordGameMode,
      status: newSession.status,
      participantCount: newSession.participants.filter(isParticipantActive).length,
    };
  }
}
