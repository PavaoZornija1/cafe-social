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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlayerService } from '../player/player.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import {
  AdminCmsAccessService,
  type AdminCmsScope,
} from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';
import { AdminUpsertVenueStaffDto } from './dto/admin-upsert-venue-staff.dto';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminVenueStaffController {
  constructor(
    private readonly venueStaff: VenueStaffService,
    private readonly players: PlayerService,
    private readonly cmsAccess: AdminCmsAccessService,
  ) {}

  @Get(':venueId/staff')
  list(@Req() req: ReqWithScope, @Param('venueId', new ParseUUIDPipe()) venueId: string) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    return this.venueStaff.listStaffForVenue(venueId);
  }

  @Post(':venueId/staff')
  async upsert(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: AdminUpsertVenueStaffDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
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
