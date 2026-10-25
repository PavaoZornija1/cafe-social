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
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { VenueModerationService } from '../venue/venue-moderation.service';

class ResolvePlayerReportDto {
  @IsBoolean()
  resetUsername!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@Controller('admin/player-reports')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminPlayerReportController {
  constructor(
    private readonly moderation: VenueModerationService,
    private readonly players: PlayerService,
  ) {}

  @Get()
  list() {
    return this.moderation.listPlatformReports();
  }

  @Post(':reportId/resolve')
  async resolve(
    @CurrentUser() user: unknown,
    @Param('reportId', new ParseUUIDPipe()) reportId: string,
    @Body() dto: ResolvePlayerReportDto,
  ) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    const actor = await this.players.findOrCreateByEmail(email);
    return this.moderation.resolvePlatformReport(
      reportId,
      actor.id,
      dto.resetUsername,
      dto.note,
    );
  }
}
