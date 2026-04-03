import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VenueStaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import type { AdminCmsScope } from './admin-cms-access.service';
import { AdminCmsAccessService } from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };
import { AdminUpsertVenueStaffDto } from './dto/admin-upsert-venue-staff.dto';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { PlayerService } from '../player/player.service';

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminVenueStaffController {
  constructor(
    private readonly venueStaff: VenueStaffService,
    private readonly players: PlayerService,
  ) {}

  @Get(':venueId/staff')
  list(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.venueStaff.listStaffForVenue(venueId);
  }

  @Post(':venueId/staff')
  async upsert(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: AdminUpsertVenueStaffDto,
  ) {
    const player = await this.players.findOrCreateByEmail(dto.email.trim());
    const existing = await this.venueStaff.findMembership(player.id, venueId);
    if (
      existing?.role === VenueStaffRole.OWNER &&
      dto.role !== VenueStaffRole.OWNER
    ) {
      await this.venueStaff.assertCanRemoveOrDemoteOwner(venueId, player.id);
    }
    return this.venueStaff.upsertMember({
      venueId,
      playerId: player.id,
      role: dto.role,
    });
  }

  @Delete(':venueId/staff/:playerId')
  async remove(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('playerId', new ParseUUIDPipe()) playerId: string,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    await this.venueStaff.assertCanRemoveOrDemoteOwner(venueId, playerId);
    await this.venueStaff.removeMember(venueId, playerId);
    return { ok: true };
  }
}
