import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlayerService } from '../player/player.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { WordRepository } from './word.repository';
import { normalizeGuess } from './word-match.util';
import { utcDayKey, previousUtcDayKey } from '../lib/day-key';
import { VenueFeedService } from '../venue-feed/venue-feed.service';
import { VenueService } from '../venue/venue.service';
import { PrismaService } from '../prisma/prisma.service';
import type { DailyWordGuessDto, DailyWordScope } from './dto/daily-word-guess.dto';
import { GameXpAwardService } from '../stats/game-xp-award.service';

const MAX_ATTEMPTS = 6;

type DailyWordRow = {
  text: string;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
};

@Injectable()
export class DailyWordService {
  constructor(
    private readonly players: PlayerService,
    private readonly words: WordRepository,
    private readonly feed: VenueFeedService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly venues: VenueService,
    private readonly gameXp: GameXpAwardService,
  ) {}

  private scopeKey(scope: DailyWordScope, venueId?: string): string {
    if (scope === 'global') return 'global';
    if (!venueId) throw new BadRequestException('venueId required for venue scope');
    return venueId;
  }

  private async assertVenueDailyAccess(params: {
    playerId: string;
    venueId: string;
    latitude?: number;
    longitude?: number;
  }): Promise<void> {
    const { playerId, venueId, latitude, longitude } = params;
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { isPremium: true, locked: true },
    });
    if (!venue) throw new BadRequestException('Venue not found');
    if (venue.locked) {
      throw new ForbiddenException('This venue is temporarily unavailable');
    }

    const hasCoords =
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);
    if (!hasCoords) {
      throw new UnauthorizedException('Location is required for the venue daily word');
    }
    await this.venues.assertCoordinatesAllowedForGuestVenue(venueId, latitude!, longitude!);

    const subscriptionActive = await this.subscriptions.isActiveSubscriber(playerId);
    if (venue.isPremium && !subscriptionActive) {
      throw new UnauthorizedException(
        'This premium venue’s daily word requires an active subscription',
      );
    }
  }

  private async assertGlobalDailySubscription(playerId: string): Promise<void> {
    const active = await this.subscriptions.isActiveSubscriber(playerId);
    if (!active) {
      throw new ForbiddenException('Global daily word requires an active subscription');
    }
  }

  /** Progressive reveal: stricter than word rooms — clues unlock as you use attempts. */
  private progressiveDailyHints(
    attemptsSoFar: number,
    solved: boolean,
    word: DailyWordRow | null,
  ): {
    answerLength: number;
    sentenceHint?: string;
    wordHints?: string[];
    emojiHints?: string[];
  } {
    if (!word) return { answerLength: 0 };
    const answerLength = word.text.length;
    if (solved) {
      return {
        answerLength,
        sentenceHint: word.sentenceHint,
        wordHints: word.wordHints,
        emojiHints: word.emojiHints,
      };
    }
    return {
      answerLength,
      ...(attemptsSoFar >= 2 ? { sentenceHint: word.sentenceHint } : {}),
      ...(attemptsSoFar >= 4 ? { wordHints: word.wordHints } : {}),
      ...(attemptsSoFar >= 5 ? { emojiHints: word.emojiHints } : {}),
    };
  }

  async getState(params: {
    email: string;
    scope: DailyWordScope;
    venueId?: string;
    latitude?: number;
    longitude?: number;
    language?: string;
  }) {
    const language = params.language ?? 'en';
    const player = await this.players.findOrCreateByEmail(params.email);
    const dayKey = utcDayKey();
    const sk = this.scopeKey(params.scope, params.venueId);

    if (params.scope === 'global') {
      await this.assertGlobalDailySubscription(player.id);
    }

    if (params.scope === 'venue' && params.venueId) {
      await this.assertVenueDailyAccess({
        playerId: player.id,
        venueId: params.venueId,
        latitude: params.latitude,
        longitude: params.longitude,
      });
    }

    const wordId = await this.words.pickWordIdForDaily(language, dayKey, sk);
    if (!wordId) throw new NotFoundException('No words for this language');

    const row = await this.prisma.playerDailyWord.findUnique({
      where: {
        playerId_dayKey_scopeKey: { playerId: player.id, dayKey, scopeKey: sk },
      },
    });

    const w = await this.prisma.word.findUnique({
      where: { id: wordId },
      select: {
        text: true,
        sentenceHint: true,
        wordHints: true,
        emojiHints: true,
      },
    });

    const streakRow = await this.prisma.playerDailyStreak.findUnique({
      where: { playerId_scopeKey: { playerId: player.id, scopeKey: sk } },
    });

    const attempts = row?.attempts ?? 0;
    const solved = !!row?.solvedAt;
    const hints = this.progressiveDailyHints(attempts, solved, w);

    return {
      dayKey,
      scope: params.scope,
      venueId: params.scope === 'venue' ? params.venueId : undefined,
      language,
      solved,
      attempts,
      maxAttempts: MAX_ATTEMPTS,
      answerLength: hints.answerLength,
      streak: streakRow?.currentStreak ?? 0,
      lastSolvedDayKey: streakRow?.lastSolvedDayKey ?? null,
      word: solved && w ? w.text : undefined,
      hints,
    };
  }

  async guess(params: { email: string; dto: DailyWordGuessDto }) {
    const { email, dto } = params;
    const language = dto.language ?? 'en';
    const player = await this.players.findOrCreateByEmail(email);
    const dayKey = utcDayKey();
    const sk = this.scopeKey(dto.scope, dto.venueId);

    if (dto.scope === 'global') {
      await this.assertGlobalDailySubscription(player.id);
    }

    if (dto.scope === 'venue' && dto.venueId) {
      await this.assertVenueDailyAccess({
        playerId: player.id,
        venueId: dto.venueId,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
    }

    const wordId = await this.words.pickWordIdForDaily(language, dayKey, sk);
    if (!wordId) throw new NotFoundException('No words for this language');

    const word = await this.prisma.word.findUnique({
      where: { id: wordId },
      select: {
        text: true,
        sentenceHint: true,
        wordHints: true,
        emojiHints: true,
      },
    });
    if (!word) throw new NotFoundException('Word not found');

    const existing = await this.prisma.playerDailyWord.findUnique({
      where: {
        playerId_dayKey_scopeKey: { playerId: player.id, dayKey, scopeKey: sk },
      },
    });

    if (existing?.solvedAt) {
      const hints = this.progressiveDailyHints(existing.attempts, true, word);
      return {
        correct: true,
        solved: true,
        attempts: existing.attempts,
        maxAttempts: MAX_ATTEMPTS,
        answerLength: hints.answerLength,
        word: word.text,
        streak: (await this.streakSnapshot(player.id, sk)).currentStreak,
        hints,
      };
    }

    if (existing && existing.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('No attempts left today');
    }

    const guessNorm = normalizeGuess(dto.guess);
    const targetNorm = normalizeGuess(word.text);
    const correct = guessNorm.length > 0 && guessNorm === targetNorm;

    const nextAttempts = (existing?.attempts ?? 0) + 1;

    if (!correct && nextAttempts >= MAX_ATTEMPTS) {
      await this.prisma.playerDailyWord.upsert({
        where: {
          playerId_dayKey_scopeKey: { playerId: player.id, dayKey, scopeKey: sk },
        },
        create: {
          playerId: player.id,
          dayKey,
          scopeKey: sk,
          attempts: nextAttempts,
        },
        update: { attempts: nextAttempts },
      });
      const hints = this.progressiveDailyHints(nextAttempts, false, word);
      return {
        correct: false,
        solved: false,
        attempts: nextAttempts,
        maxAttempts: MAX_ATTEMPTS,
        answerLength: hints.answerLength,
        streak: (await this.streakSnapshot(player.id, sk)).currentStreak,
        hints,
      };
    }

    if (correct) {
      const solvedAt = new Date();
      await this.prisma.playerDailyWord.upsert({
        where: {
          playerId_dayKey_scopeKey: { playerId: player.id, dayKey, scopeKey: sk },
        },
        create: {
          playerId: player.id,
          dayKey,
          scopeKey: sk,
          attempts: nextAttempts,
          solvedAt,
        },
        update: { attempts: nextAttempts, solvedAt },
      });

      const streak = await this.bumpStreak(player.id, sk, dayKey);

      void this.gameXp.tryAwardDailyWordFirstSolve({
        playerId: player.id,
        dayKey,
        scopeKey: sk,
        venueId: dto.scope === 'venue' ? (dto.venueId ?? null) : null,
      });

      if (dto.scope === 'venue' && dto.venueId) {
        void this.feed.recordDailyWordSolved(dto.venueId, player.username);
      }

      const hintsSolved = this.progressiveDailyHints(nextAttempts, true, word);
      return {
        correct: true,
        solved: true,
        attempts: nextAttempts,
        maxAttempts: MAX_ATTEMPTS,
        answerLength: hintsSolved.answerLength,
        word: word.text,
        streak: streak.currentStreak,
        hints: hintsSolved,
      };
    }

    await this.prisma.playerDailyWord.upsert({
      where: {
        playerId_dayKey_scopeKey: { playerId: player.id, dayKey, scopeKey: sk },
      },
      create: {
        playerId: player.id,
        dayKey,
        scopeKey: sk,
        attempts: nextAttempts,
      },
      update: { attempts: nextAttempts },
    });

    const hintsWrong = this.progressiveDailyHints(nextAttempts, false, word);
    return {
      correct: false,
      solved: false,
      attempts: nextAttempts,
      maxAttempts: MAX_ATTEMPTS,
      answerLength: hintsWrong.answerLength,
      streak: (await this.streakSnapshot(player.id, sk)).currentStreak,
      hints: hintsWrong,
    };
  }

  private async streakSnapshot(playerId: string, scopeKey: string) {
    const row = await this.prisma.playerDailyStreak.findUnique({
      where: { playerId_scopeKey: { playerId, scopeKey } },
    });
    return { currentStreak: row?.currentStreak ?? 0 };
  }

  private async bumpStreak(playerId: string, scopeKey: string, dayKey: string) {
    const row = await this.prisma.playerDailyStreak.findUnique({
      where: { playerId_scopeKey: { playerId, scopeKey } },
    });

    const last = row?.lastSolvedDayKey ?? null;
    let next = 1;
    if (last === dayKey) {
      next = row?.currentStreak ?? 1;
    } else if (last === previousUtcDayKey(dayKey)) {
      next = (row?.currentStreak ?? 0) + 1;
    } else {
      next = 1;
    }

    return this.prisma.playerDailyStreak.upsert({
      where: { playerId_scopeKey: { playerId, scopeKey } },
      create: {
        playerId,
        scopeKey,
        currentStreak: next,
        lastSolvedDayKey: dayKey,
      },
      update: {
        currentStreak: next,
        lastSolvedDayKey: dayKey,
      },
    });
  }
}
