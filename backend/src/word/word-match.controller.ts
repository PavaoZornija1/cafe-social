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
import { PlayerService } from '../player/player.service';
import { WordMatchService } from './word-match.service';
import { CreateWordMatchDto } from './dto/create-word-match.dto';
import { JoinWordMatchDto } from './dto/join-word-match.dto';
import { CoopGuessDto } from './dto/coop-guess.dto';
import { VersusScoreDto } from './dto/versus-score.dto';

@Controller('words/matches')
@UseGuards(JwtAuthGuard)
export class WordMatchController {
  constructor(
    private readonly match: WordMatchService,
    private readonly players: PlayerService,
  ) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Post()
  create(@CurrentUser() user: unknown, @Body() dto: CreateWordMatchDto) {
    return this.match.create(this.email(user), dto);
  }

  /** Static path before :sessionId routes */
  @Post('join')
  join(@CurrentUser() user: unknown, @Body() dto: JoinWordMatchDto) {
    return this.match.joinByCode(this.email(user), dto);
  }

  @Post(':sessionId/start')
  start(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.match.start(this.email(user), sessionId);
  }

  @Get(':sessionId/state')
  async getState(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    const player = await this.players.findOrCreateByEmail(this.email(user));
    return this.match.getStateForViewer(player.id, sessionId);
  }

  @Get(':sessionId/deck')
  getDeck(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
  ) {
    const lat = latRaw !== undefined && latRaw !== '' ? Number(latRaw) : NaN;
    const lng = lngRaw !== undefined && lngRaw !== '' ? Number(lngRaw) : NaN;
    const latOk = Number.isFinite(lat);
    const lngOk = Number.isFinite(lng);
    return this.match.getDeck(
      this.email(user),
      sessionId,
      latOk ? lat : undefined,
      lngOk ? lng : undefined,
    );
  }

  @Post(':sessionId/coop-guess')
  coopGuess(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CoopGuessDto,
  ) {
    return this.match.coopGuess(this.email(user), sessionId, dto);
  }

  @Post(':sessionId/versus-score')
  versusScore(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: VersusScoreDto,
  ) {
    return this.match.versusScore(this.email(user), sessionId, dto);
  }
}
