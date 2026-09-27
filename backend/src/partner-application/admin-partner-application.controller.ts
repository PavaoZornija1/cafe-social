import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PartnerVenueApplicationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { normalizeUserEmail } from '../auth/user-email.util';
import { UnauthorizedException } from '@nestjs/common';
import { PlayerService } from '../player/player.service';
import { ApprovePartnerApplicationDto } from './dto/approve-partner-application.dto';
import { RejectPartnerApplicationDto } from './dto/reject-partner-application.dto';
import { PartnerApplicationService } from './partner-application.service';

@Controller('admin/partner-applications')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminPartnerApplicationController {
  constructor(
    private readonly applications: PartnerApplicationService,
    private readonly players: PlayerService,
  ) {}

  @Get()
  async list(
    @Query('status') statusRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('search') search?: string,
  ) {
    const status = this.parseStatus(statusRaw);
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '25', 10) || 25));
    return this.applications.listForAdmin({
      status,
      page,
      limit,
      search,
    });
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.getByIdForAdmin(id);
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApprovePartnerApplicationDto,
  ) {
    const reviewer = await this.resolveReviewerPlayer(user);
    return this.applications.approve(id, reviewer.id, body);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: unknown,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectPartnerApplicationDto,
  ) {
    const reviewer = await this.resolveReviewerPlayer(user);
    return this.applications.reject(id, reviewer.id, body.reason);
  }

  private parseStatus(raw?: string): PartnerVenueApplicationStatus | undefined {
    const s = raw?.trim().toUpperCase();
    if (!s) return undefined;
    if (s === 'PENDING' || s === 'APPROVED' || s === 'REJECTED') {
      return s as PartnerVenueApplicationStatus;
    }
    throw new BadRequestException(
      'status must be PENDING, APPROVED, or REJECTED',
    );
  }

  private async resolveReviewerPlayer(user: unknown) {
    const email = normalizeUserEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.players.findOrCreateByEmail(email.trim());
  }
}
