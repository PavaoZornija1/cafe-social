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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { BrawlerService } from './brawler.service';
import { CreateBrawlerSessionDto } from './dto/create-brawler-session.dto';
import { CreatePartyBrawlerSessionDto } from './dto/create-party-brawler-session.dto';
import { RecordBrawlerEventsDto } from './dto/record-brawler-events.dto';
import { FinalizeBrawlerSessionDto } from './dto/finalize-brawler-session.dto';
import { PickBrawlerPowerupDto } from './dto/pick-brawler-powerup.dto';
import { TickBrawlerArenaDto } from './dto/tick-brawler-arena.dto';
import {
  EnqueueBrawlerMatchQueueDto,
  LeaveBrawlerMatchQueueDto,
} from './dto/enqueue-brawler-match-queue.dto';
import { BrawlerIfRevDto } from './dto/brawler-if-rev.dto';
import { resolveIfSnapshotRev } from '../game-runtime/snapshot-rev.util';

@Controller('brawler')
@UseGuards(JwtAuthGuard)
export class BrawlerController {
  constructor(private readonly brawler: BrawlerService) {}

  private email(user: unknown): string {
    const e = normalizeUserEmail(user);
    if (!e) throw new UnauthorizedException('Missing user email');
    return e;
  }

  @Get('heroes')
  listHeroes() {
    return this.brawler.listHeroes();
  }

  @Get('powerups')
  listPowerups() {
    return this.brawler.listPowerups();
  }

  @Post('sessions/party')
  createPartySession(
    @CurrentUser() user: unknown,
    @Body() dto: CreatePartyBrawlerSessionDto,
  ) {
    return this.brawler.createPartySession(this.email(user), dto);
  }

  @Post('sessions')
  createSession(
    @CurrentUser() user: unknown,
    @Body() dto: CreateBrawlerSessionDto,
  ) {
    return this.brawler.createSession(this.email(user), dto);
  }

  @Get('sessions/:sessionId')
  getSession(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.brawler.getSession(sessionId, this.email(user));
  }

  @Post('sessions/:sessionId/start')
  startSession(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() meta: BrawlerIfRevDto,
  ) {
    return this.brawler.startSession(
      sessionId,
      this.email(user),
      resolveIfSnapshotRev(ifMatch, meta.ifSnapshotRev),
      meta.latitude,
      meta.longitude,
    );
  }

  @Post('sessions/:sessionId/events')
  recordEvents(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: RecordBrawlerEventsDto,
  ) {
    return this.brawler.recordEvents(sessionId, this.email(user), dto, ifMatch);
  }

  @Get('sessions/:sessionId/arena/state')
  getArenaState(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.brawler.getArenaState(sessionId, this.email(user));
  }

  @Post('sessions/:sessionId/arena/tick')
  tickArena(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: TickBrawlerArenaDto,
  ) {
    return this.brawler.tickArena(sessionId, this.email(user), dto);
  }

  @Post('sessions/:sessionId/powerups/pick')
  pickPowerup(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: PickBrawlerPowerupDto,
  ) {
    return this.brawler.pickPowerup(sessionId, this.email(user), dto);
  }

  @Post('sessions/:sessionId/finalize')
  finalizeSession(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: FinalizeBrawlerSessionDto,
  ) {
    return this.brawler.finalizeSession(sessionId, dto, this.email(user), ifMatch);
  }

  @Post('sessions/:sessionId/abandon')
  abandonSession(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() meta: BrawlerIfRevDto,
  ) {
    return this.brawler.abandonSession(
      sessionId,
      this.email(user),
      resolveIfSnapshotRev(ifMatch, meta.ifSnapshotRev),
    );
  }

  @Post('sessions/:sessionId/forfeit')
  forfeitSession(
    @CurrentUser() user: unknown,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() meta: BrawlerIfRevDto,
  ) {
    return this.brawler.forfeitSession(
      sessionId,
      this.email(user),
      resolveIfSnapshotRev(ifMatch, meta.ifSnapshotRev),
    );
  }

  @Post('queue/enqueue')
  @UseGuards(ThrottlerGuard)
  @Throttle({ enqueue: { limit: 30, ttl: 60000 } })
  queueEnqueue(@CurrentUser() user: unknown, @Body() dto: EnqueueBrawlerMatchQueueDto) {
    return this.brawler.enqueueVenueBrawlerMatch(this.email(user), dto);
  }

  @Get('queue/me')
  queueMe(@CurrentUser() user: unknown, @Query('venueId') venueId?: string) {
    // venueId optional: subscribers can queue without a venue; others may also
    // omit it to look up whichever in-flight queue row they currently have.
    return this.brawler.getVenueBrawlerQueueStatus(this.email(user), venueId);
  }

  @Post('queue/leave')
  queueLeave(@CurrentUser() user: unknown, @Body() dto: LeaveBrawlerMatchQueueDto) {
    return this.brawler.leaveVenueBrawlerQueue(this.email(user), dto.venueId);
  }
}
