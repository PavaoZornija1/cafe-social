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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { WordRepository } from './word.repository';
import type { CreateWordMatchDto } from './dto/create-word-match.dto';
import type { CoopGuessDto } from './dto/coop-guess.dto';
import type { VersusScoreDto } from './dto/versus-score.dto';
import { WORD_MATCH_REFRESH_EVENT } from './word-match.gateway';
import { PushService } from '../push/push.service';
import { VenueFeedService } from '../venue-feed/venue-feed.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { VenueService } from '../venue/venue.service';
import { normalizeGuess } from './word-match.util';

export type WordMatchConfig = {
  wordGameMode: 'coop' | 'versus';
  difficulty: string;
  wordIds: string[];
  hostPlayerId: string;
};

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
    const at = await this.venues.findVenueAtCoordinates(latitude!, longitude!);
    if (!at || at.id !== sessionVenueId) {
      throw new ForbiddenException('You must be at the venue to play this match');
    }
  }

  private pushSessionRefresh(sessionId: string) {
    this.events.emit(WORD_MATCH_REFRESH_EVENT, sessionId);
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
      count: dto.wordCount,
    });
    if (deck.length === 0) {
      throw new BadRequestException('no words for this language');
    }
    const wordIds = deck.map((w) => w.id);
    const inviteCode = await this.newInviteCode();
    const config: WordMatchConfig = {
      wordGameMode: dto.mode,
      difficulty: dto.difficulty,
      wordIds,
      hostPlayerId: player.id,
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
    if (session.participants.length >= max) {
      throw new BadRequestException('match is full');
    }
    if (session.participants.some((p) => p.playerId === player.id)) {
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

    const alreadyThere = session.participants
      .map((p) => p.playerId)
      .filter((id): id is string => !!id);

    await this.prisma.gameParticipant.create({
      data: {
        sessionId: session.id,
        playerId: player.id,
        isBot: false,
        displayNameSnapshot: player.username,
      },
    });

    this.pushSessionRefresh(session.id);

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
    if (session.participants.filter((p) => p.playerId).length < 2) {
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

    this.pushSessionRefresh(sessionId);

    const participantIds = session.participants
      .map((p) => p.playerId)
      .filter((id): id is string => !!id);
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
    const isParticipant = session.participants.some((p) => p.playerId === playerId);
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
      hostPlayerId: config.hostPlayerId,
      inviteCode: session.inviteCode,
      targetWordCount: config.wordIds.length,
      sharedWordIndex: ws?.sharedWordIndex ?? 0,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      participants: session.participants.map((p) => ({
        id: p.id,
        playerId: p.playerId,
        username: p.displayNameSnapshot ?? p.player?.username ?? 'Player',
        score: p.score,
        result: p.result,
        isYou: viewerPlayerId ? p.playerId === viewerPlayerId : false,
      })),
      isParticipant: viewerPlayerId
        ? session.participants.some((p) => p.playerId === viewerPlayerId)
        : false,
    };
  }

  private async ensureParticipant(sessionId: string, playerId: string) {
    const p = await this.prisma.gameParticipant.findFirst({
      where: { sessionId, playerId },
    });
    if (!p) throw new ForbiddenException('not in this match');
    return p;
  }

  async getDeck(
    email: string,
    sessionId: string,
    latitude?: number,
    longitude?: number,
  ) {
    const player = await this.players.findOrCreateByEmail(email);
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { wordSession: true },
    });
    if (!session || session.gameType !== GameType.WORD_GAME) {
      throw new NotFoundException('session not found');
    }
    if (session.status !== GameSessionStatus.ACTIVE) {
      throw new BadRequestException('match is not active');
    }
    await this.ensureParticipant(sessionId, player.id);
    await this.assertAtVenueIfNeeded(session.venueId, latitude, longitude);

    const config = session.config as unknown as WordMatchConfig;
    const words = await this.prisma.word.findMany({
      where: { id: { in: config.wordIds } },
    });
    const byId = new Map(words.map((w) => [w.id, w]));
    const ordered = config.wordIds.map((id) => byId.get(id)).filter(Boolean);
    if (ordered.length !== config.wordIds.length) {
      throw new BadRequestException('word deck corrupted');
    }

    return {
      words: ordered.map((w) => ({
        id: w!.id,
        text: w!.text,
        language: w!.language,
        category: w!.category,
        sentenceHint: w!.sentenceHint,
        wordHints: w!.wordHints,
        emojiHints: w!.emojiHints,
      })),
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
        return { done: true, correct: false, newIndex: idx };
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
        return { done: false, correct: false, newIndex: idx };
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
        for (const p of session.participants) {
          if (!p.playerId) continue;
          await tx.gameParticipant.update({
            where: { id: p.id },
            data: { result: GameParticipantResult.WIN },
          });
        }
        return { done: true, correct: true, newIndex: nextIdx };
      }

      return { done: false, correct: true, newIndex: nextIdx };
    });

    if (result.correct) {
      this.pushSessionRefresh(sessionId);
    }
    return result;
  }

  async versusScore(email: string, sessionId: string, dto: VersusScoreDto) {
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

      const updated = await tx.gameParticipant.update({
        where: { id: part.id },
        data: { score: { increment: dto.increment } },
      });

      await tx.wordParticipantStats.upsert({
        where: { participantId: part.id },
        create: { participantId: part.id, correctAnswers: dto.increment },
        update: { correctAnswers: { increment: dto.increment } },
      });

      if (updated.score >= target) {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { status: GameSessionStatus.FINISHED, endedAt: new Date() },
        });
        for (const p of session.participants) {
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
        return { finished: true, yourScore: updated.score, winner: true };
      }

      return { finished: false, yourScore: updated.score, winner: false };
    });

    this.pushSessionRefresh(sessionId);
    return result;
  }
}
