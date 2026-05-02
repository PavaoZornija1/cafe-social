import {
  Body,
  Controller,
  Get,
  Headers,
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
import {
  EnqueueWordMatchQueueDto,
  LeaveWordMatchQueueDto,
} from './dto/enqueue-word-match-queue.dto';
import { JoinWordMatchDto } from './dto/join-word-match.dto';
import { CoopGuessDto } from './dto/coop-guess.dto';
import { MatchPassDto } from './dto/match-pass.dto';
import { WordMatchIfRevDto } from './dto/word-match-if-rev.dto';
import { resolveIfSnapshotRev } from '../game-runtime/snapshot-rev.util';

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

  @Post('queue/enqueue')
  queueEnqueue(@CurrentUser() user: unknown, @Body() dto: EnqueueWordMatchQueueDto) {
    return this.match.enqueueVenueWordMatch(this.email(user), dto);
  }

  @Get('queue/me')
  queueMe(@CurrentUser() user: unknown, @Query('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.match.getVenueQueueStatus(this.email(user), venueId);
  }

  @Post('queue/leave')
  queueLeave(@CurrentUser() user: unknown, @Body() dto: LeaveWordMatchQueueDto) {
    return this.match.leaveVenueWordQueue(this.email(user), dto.venueId);
  }

  @Post(':sessionId/start')
  start(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() meta: WordMatchIfRevDto,
  ) {
    return this.match.start(
      this.email(user),
      sessionId,
      resolveIfSnapshotRev(ifMatch, meta.ifSnapshotRev),
    );
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
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: CoopGuessDto,
  ) {
    return this.match.coopGuess(this.email(user), sessionId, dto, ifMatch);
  }

  @Post(':sessionId/coop-pass')
  coopPass(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: MatchPassDto,
  ) {
    return this.match.coopPass(this.email(user), sessionId, dto, ifMatch);
  }

  @Post(':sessionId/versus-guess')
  versusGuess(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: CoopGuessDto,
  ) {
    return this.match.versusGuess(this.email(user), sessionId, dto, ifMatch);
  }

  @Post(':sessionId/leave')
  leave(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() meta: WordMatchIfRevDto,
  ) {
    return this.match.leave(
      this.email(user),
      sessionId,
      resolveIfSnapshotRev(ifMatch, meta.ifSnapshotRev),
    );
  }

  @Post(':sessionId/rematch')
  rematch(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() meta: WordMatchIfRevDto,
  ) {
    return this.match.rematch(
      this.email(user),
      sessionId,
      resolveIfSnapshotRev(ifMatch, meta.ifSnapshotRev),
    );
  }
}
