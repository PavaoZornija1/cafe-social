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

const MAX_ATTEMPTS = 6;

@Injectable()
export class DailyWordService {
  constructor(
    private readonly players: PlayerService,
    private readonly words: WordRepository,
    private readonly feed: VenueFeedService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly venues: VenueService,
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

    const w = await this.words.getWordTextById(wordId);
    const answerLength = w?.text.length ?? 0;

    const streakRow = await this.prisma.playerDailyStreak.findUnique({
      where: { playerId_scopeKey: { playerId: player.id, scopeKey: sk } },
    });

    return {
      dayKey,
      scope: params.scope,
      venueId: params.scope === 'venue' ? params.venueId : undefined,
      language,
      solved: !!row?.solvedAt,
      attempts: row?.attempts ?? 0,
      maxAttempts: MAX_ATTEMPTS,
      answerLength,
      streak: streakRow?.currentStreak ?? 0,
      lastSolvedDayKey: streakRow?.lastSolvedDayKey ?? null,
      word: row?.solvedAt && w ? w.text : undefined,
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

    const word = await this.words.getWordTextById(wordId);
    if (!word) throw new NotFoundException('Word not found');

    const existing = await this.prisma.playerDailyWord.findUnique({
      where: {
        playerId_dayKey_scopeKey: { playerId: player.id, dayKey, scopeKey: sk },
      },
    });

    if (existing?.solvedAt) {
      return {
        correct: true,
        solved: true,
        attempts: existing.attempts,
        maxAttempts: MAX_ATTEMPTS,
        word: word.text,
        streak: (await this.streakSnapshot(player.id, sk)).currentStreak,
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
      return {
        correct: false,
        solved: false,
        attempts: nextAttempts,
        maxAttempts: MAX_ATTEMPTS,
        streak: (await this.streakSnapshot(player.id, sk)).currentStreak,
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

      if (dto.scope === 'venue' && dto.venueId) {
        void this.feed.recordDailyWordSolved(dto.venueId, player.username);
      }

      return {
        correct: true,
        solved: true,
        attempts: nextAttempts,
        maxAttempts: MAX_ATTEMPTS,
        word: word.text,
        streak: streak.currentStreak,
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

    return {
      correct: false,
      solved: false,
      attempts: nextAttempts,
      maxAttempts: MAX_ATTEMPTS,
      streak: (await this.streakSnapshot(player.id, sk)).currentStreak,
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
