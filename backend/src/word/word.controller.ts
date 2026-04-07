import {
  Controller,
  Get,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { WordService } from './word.service';
import type { WordCategory } from '@prisma/client';

type WordSessionQuery = {
  language?: string;
  category?: WordCategory;
  count?: string;
  /** When true, player is in global (no-venue) mode — requires active subscription. */
  globalPlay?: string;
  venueId?: string;
  lat?: string;
  lng?: string;
};

@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordController {
  constructor(private readonly words: WordService) {}

  @Get('session')
  async getSessionDeck(@CurrentUser() user: unknown, @Query() query: WordSessionQuery) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const language = query.language ?? 'en';
    const count = Number(query.count ?? '5');
    const category = query.category;
    const globalPlay =
      query.globalPlay === '1' || query.globalPlay === 'true' || query.globalPlay === 'yes';
    const latRaw = query.lat;
    const lngRaw = query.lng;
    const lat = latRaw !== undefined && latRaw !== '' ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : NaN;
    const latOk = Number.isFinite(lat);
    const lngOk = Number.isFinite(lng);

    return this.words.getWordSessionDeck({
      email,
      language,
      category,
      count,
      globalPlay,
      venueId: query.venueId,
      latitude: latOk ? lat : undefined,
      longitude: lngOk ? lng : undefined,
    });
  }
}
