import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WordCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { VenueService } from '../venue/venue.service';
import { WordRepository } from './word.repository';
import { wordToPublicHints, type WordPublicHint } from './word-hint.util';
import { normalizeGuess } from './word-match.util';
import type { CreateSoloWordSessionDto } from './dto/create-solo-word-session.dto';
import type { CoopGuessDto } from './dto/coop-guess.dto';
import { GameXpAwardService } from '../stats/game-xp-award.service';

const SOLO_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class WordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly words: WordRepository,
    private readonly players: PlayerService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly venues: VenueService,
    private readonly venuePlayLimit: VenuePlayLimitService,
    private readonly gameXp: GameXpAwardService,
  ) {}

  private async assertSoloPlayAllowed(params: {
    playerId: string;
    language: string;
    globalPlay?: boolean;
    venueId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<void> {
    if (!params.language) throw new BadRequestException('language is required');
    if (params.globalPlay) {
      const ok = await this.subscriptions.isActiveSubscriber(params.playerId);
      if (!ok) {
        throw new ForbiddenException('Solo games without a venue require an active subscription');
      }
    } else {
      const vId = params.venueId?.trim();
      if (!vId) {
        throw new ForbiddenException(
          'Venue solo play requires venueId and your current location (lat/lng)',
        );
      }
      const hasCoords =
        typeof params.latitude === 'number' &&
        typeof params.longitude === 'number' &&
        Number.isFinite(params.latitude) &&
        Number.isFinite(params.longitude);
      if (!hasCoords) {
        throw new ForbiddenException('Venue solo play requires your current location (lat/lng)');
      }
      await this.venues.assertCoordinatesAllowedForGuestVenue(
        vId,
        params.latitude!,
        params.longitude!,
      );
    }
  }

  private async loadSoloSessionForPlayer(sessionId: string, playerId: string) {
    const row = await this.prisma.soloWordSession.findUnique({
      where: { id: sessionId },
    });
    if (!row) throw new NotFoundException('session not found');
    if (row.playerId !== playerId) throw new ForbiddenException('not your session');
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('session expired');
    }
    return row;
  }

  async startSoloWordSession(email: string, dto: CreateSoloWordSessionDto) {
    const globalPlay = dto.globalPlay === true;

    const player = await this.players.findOrCreateByEmail(email);
    await this.assertSoloPlayAllowed({
      playerId: player.id,
      language: dto.language,
      globalPlay,
      venueId: dto.venueId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    if (!globalPlay && dto.venueId?.trim()) {
      await this.venuePlayLimit.beginSoloWord(player.id, dto.venueId.trim());
    }

    const deck = await this.words.findRandomSessionDeck({
      language: dto.language,
      category: dto.category,
      count: dto.wordCount,
      difficulty: dto.difficulty,
    });
    if (deck.length === 0) {
      throw new BadRequestException('no words for this language/category');
    }

    const expiresAt = new Date(Date.now() + SOLO_SESSION_TTL_MS);
    const session = await this.prisma.soloWordSession.create({
      data: {
        playerId: player.id,
        wordIds: deck.map((w) => w.id),
        language: dto.language,
        category: dto.category ?? null,
        difficulty: dto.difficulty,
        venueId: dto.venueId?.trim() ?? null,
        globalPlay,
        expiresAt,
      },
    });

    const first = deck[0]!;
    return {
      sessionId: session.id,
      targetWordCount: deck.length,
      wordIndex: 0,
      currentWord: wordToPublicHints(first),
    };
  }

  async getSoloDeck(
    email: string,
    sessionId: string,
    latitude?: number,
    longitude?: number,
  ): Promise<{
    targetWordCount: number;
    wordIndex: number;
    finished: boolean;
    currentWord: WordPublicHint | null;
  }> {
    const player = await this.players.findOrCreateByEmail(email);
    const row = await this.loadSoloSessionForPlayer(sessionId, player.id);

    if (row.finishedAt) {
      return {
        targetWordCount: row.wordIds.length,
        wordIndex: row.wordIndex,
        finished: true,
        currentWord: null,
      };
    }

    if (row.venueId) {
      const hasCoords =
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude);
      if (!hasCoords) {
        throw new ForbiddenException('Venue solo play requires your current location (lat/lng)');
      }
      await this.venues.assertCoordinatesAllowedForGuestVenue(row.venueId, latitude!, longitude!);
    }

    if (row.wordIndex >= row.wordIds.length) {
      return {
        targetWordCount: row.wordIds.length,
        wordIndex: row.wordIndex,
        finished: true,
        currentWord: null,
      };
    }

    const w = await this.words.findWordById(row.wordIds[row.wordIndex]!);
    if (!w) throw new BadRequestException('word missing');

    return {
      targetWordCount: row.wordIds.length,
      wordIndex: row.wordIndex,
      finished: false,
      currentWord: wordToPublicHints(w),
    };
  }

  async soloGuess(email: string, sessionId: string, dto: CoopGuessDto) {
    const player = await this.players.findOrCreateByEmail(email);
    const row = await this.loadSoloSessionForPlayer(sessionId, player.id);

    if (row.finishedAt) {
      throw new BadRequestException('session already finished');
    }

    if (row.venueId) {
      await this.assertSoloPlayAllowed({
        playerId: player.id,
        language: row.language,
        globalPlay: row.globalPlay,
        venueId: row.venueId ?? undefined,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
    }

    if (row.wordIndex >= row.wordIds.length) {
      throw new BadRequestException('already completed deck');
    }

    const wordId = row.wordIds[row.wordIndex]!;
    const word = await this.words.findWordById(wordId);
    if (!word) throw new BadRequestException('word missing');

    const ok = normalizeGuess(dto.guess) === normalizeGuess(word.text);
    if (!ok) {
      return {
        correct: false,
        finished: false,
        wordIndex: row.wordIndex,
        targetWordCount: row.wordIds.length,
        currentWord: wordToPublicHints(word),
      };
    }

    const nextIdx = row.wordIndex + 1;
    if (nextIdx >= row.wordIds.length) {
      await this.prisma.soloWordSession.update({
        where: { id: sessionId },
        data: { wordIndex: nextIdx, finishedAt: new Date() },
      });
      void this.gameXp.tryAwardSoloWordDeckComplete(sessionId);
      return {
        correct: true,
        finished: true,
        wordIndex: nextIdx,
        targetWordCount: row.wordIds.length,
        currentWord: null,
      };
    }

    const nextW = await this.words.findWordById(row.wordIds[nextIdx]!);
    if (!nextW) throw new BadRequestException('word missing');

    await this.prisma.soloWordSession.update({
      where: { id: sessionId },
      data: { wordIndex: nextIdx },
    });

    return {
      correct: true,
      finished: false,
      wordIndex: nextIdx,
      targetWordCount: row.wordIds.length,
      currentWord: wordToPublicHints(nextW),
    };
  }
}
