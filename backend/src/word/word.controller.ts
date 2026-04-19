import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { WordService } from './word.service';
import { CreateSoloWordSessionDto } from './dto/create-solo-word-session.dto';
import { CoopGuessDto } from './dto/coop-guess.dto';

@Controller('words')
@UseGuards(JwtAuthGuard)
export class WordController {
  constructor(private readonly words: WordService) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  /** Start a server-backed solo run (hints only; guesses validated on POST …/guess). */
  @Post('session/start')
  startSolo(@CurrentUser() user: unknown, @Body() dto: CreateSoloWordSessionDto) {
    return this.words.startSoloWordSession(this.email(user), dto);
  }

  @Get('session/:sessionId/deck')
  soloDeck(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
  ) {
    const lat = latRaw !== undefined && latRaw !== '' ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : NaN;
    const latOk = Number.isFinite(lat);
    const lngOk = Number.isFinite(lng);
    return this.words.getSoloDeck(
      this.email(user),
      sessionId,
      latOk ? lat : undefined,
      lngOk ? lng : undefined,
    );
  }

  @Post('session/:sessionId/guess')
  soloGuess(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CoopGuessDto,
  ) {
    return this.words.soloGuess(this.email(user), sessionId, dto);
  }
}
