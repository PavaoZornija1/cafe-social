import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { DailyWordService } from './daily-word.service';
import { DailyWordGuessDto, type DailyWordScope } from './dto/daily-word-guess.dto';

@Controller('words')
@UseGuards(JwtAuthGuard)
export class DailyWordController {
  constructor(private readonly daily: DailyWordService) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Get('daily')
  async getDaily(
    @CurrentUser() user: unknown,
    @Query('scope') scopeRaw?: string,
    @Query('venueId') venueId?: string,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
    @Query('language') language?: string,
  ) {
    const scope = (scopeRaw === 'venue' ? 'venue' : 'global') as DailyWordScope;
    const lat = latRaw !== undefined && latRaw !== '' ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : NaN;
    const latOk = Number.isFinite(lat);
    const lngOk = Number.isFinite(lng);
    return this.daily.getState({
      email: this.email(user),
      scope,
      venueId: venueId || undefined,
      latitude: latOk ? lat : undefined,
      longitude: lngOk ? lng : undefined,
      language,
    });
  }

  @Post('daily/guess')
  async guess(@CurrentUser() user: unknown, @Body() dto: DailyWordGuessDto) {
    return this.daily.guess({ email: this.email(user), dto });
  }
}
