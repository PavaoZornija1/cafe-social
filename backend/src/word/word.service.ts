import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Word, WordCategory } from '@prisma/client';
import { PlayerService } from '../player/player.service';
import { SubscriptionRepository } from '../venue/subscription.repository';
import { VenuePlayLimitService } from '../venue/venue-play-limit.service';
import { VenueService } from '../venue/venue.service';
import { WordRepository } from './word.repository';

export type WordSessionDto = {
  words: Array<{
    id: string;
    text: string;
    language: string;
    category: WordCategory;
    sentenceHint: string;
    wordHints: string[];
    emojiHints: string[];
  }>;
};

@Injectable()
export class WordService {
  constructor(
    private readonly words: WordRepository,
    private readonly players: PlayerService,
    private readonly subscriptions: SubscriptionRepository,
    private readonly venues: VenueService,
    private readonly venuePlayLimit: VenuePlayLimitService,
  ) {}

  async getWordSessionDeck(params: {
    email: string;
    language: string;
    category?: WordCategory;
    count: number;
    globalPlay?: boolean;
    venueId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<WordSessionDto> {
    if (!params.language) throw new BadRequestException('language is required');
    if (params.count <= 0) throw new BadRequestException('count must be > 0');

    const player = await this.players.findOrCreateByEmail(params.email);
    if (params.globalPlay) {
      const ok = await this.subscriptions.isActiveSubscriber(player.id);
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

    if (!params.globalPlay && params.venueId?.trim()) {
      await this.venuePlayLimit.beginSoloWord(player.id, params.venueId.trim());
    }

    const rows: Word[] = await this.words.findRandomSessionDeck({
      language: params.language,
      category: params.category,
      count: params.count,
    });

    return {
      words: rows.map((w) => ({
        id: w.id,
        text: w.text,
        language: w.language,
        category: w.category,
        sentenceHint: w.sentenceHint,
        wordHints: w.wordHints,
        emojiHints: w.emojiHints,
      })),
    };
  }
}

