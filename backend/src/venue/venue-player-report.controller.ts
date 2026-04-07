import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { VenueModerationService } from './venue-moderation.service';
import { ReportPlayerDto } from './dto/report-player.dto';

@Controller('venue-context')
@UseGuards(JwtAuthGuard)
export class VenuePlayerReportController {
  constructor(
    private readonly players: PlayerService,
    private readonly moderation: VenueModerationService,
  ) {}

  @Post(':venueId/report-player')
  async reportPlayer(
    @CurrentUser() user: unknown,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: ReportPlayerDto,
  ) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const reporter = await this.players.findOrCreateByEmail(email);
    return this.moderation.createReport({
      venueId,
      reporterId: reporter.id,
      reportedPlayerId: dto.reportedPlayerId,
      reason: dto.reason,
      note: dto.note ?? null,
    });
  }
}
