import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  startSession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.brawler.startSession(sessionId);
  }

  @Post('sessions/:sessionId/events')
  recordEvents(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: RecordBrawlerEventsDto,
  ) {
    return this.brawler.recordEvents(sessionId, dto);
  }

  @Post('sessions/:sessionId/finalize')
  finalizeSession(
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: FinalizeBrawlerSessionDto,
  ) {
    return this.brawler.finalizeSession(sessionId, dto);
  }
}

