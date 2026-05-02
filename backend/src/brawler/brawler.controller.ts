import {
  BadRequestException,
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
import { BrawlerService } from './brawler.service';
import { CreateBrawlerSessionDto } from './dto/create-brawler-session.dto';
import { RecordBrawlerEventsDto } from './dto/record-brawler-events.dto';
import { FinalizeBrawlerSessionDto } from './dto/finalize-brawler-session.dto';
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

  @Post('sessions')
  createSession(
    @CurrentUser() user: unknown,
    @Body() dto: CreateBrawlerSessionDto,
  ) {
    return this.brawler.createSession(this.email(user), dto);
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.brawler.getSession(sessionId);
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
    );
  }

  @Post('sessions/:sessionId/events')
  recordEvents(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: RecordBrawlerEventsDto,
  ) {
    return this.brawler.recordEvents(sessionId, dto, ifMatch);
  }

  @Post('sessions/:sessionId/finalize')
  finalizeSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Headers('if-match') ifMatch: string | undefined,
    @Body() dto: FinalizeBrawlerSessionDto,
  ) {
    return this.brawler.finalizeSession(sessionId, dto, ifMatch);
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

  @Post('queue/enqueue')
  queueEnqueue(@CurrentUser() user: unknown, @Body() dto: EnqueueBrawlerMatchQueueDto) {
    return this.brawler.enqueueVenueBrawlerMatch(this.email(user), dto);
  }

  @Get('queue/me')
  queueMe(@CurrentUser() user: unknown, @Query('venueId') venueId?: string) {
    if (!venueId?.trim()) {
      throw new BadRequestException('venueId query parameter is required');
    }
    return this.brawler.getVenueBrawlerQueueStatus(this.email(user), venueId);
  }

  @Post('queue/leave')
  queueLeave(@CurrentUser() user: unknown, @Body() dto: LeaveBrawlerMatchQueueDto) {
    return this.brawler.leaveVenueBrawlerQueue(this.email(user), dto.venueId);
  }
}

