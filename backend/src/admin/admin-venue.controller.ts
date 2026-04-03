import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VenueService } from '../venue/venue.service';
import { CreateVenueDto } from '../venue/dto/create-venue.dto';
import { AdminPatchVenueDto } from '../venue/dto/admin-patch-venue.dto';
import {
  AdminCmsAccessService,
  type AdminCmsScope,
} from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';
import type { Request } from 'express';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };

/**
 * Platform CMS: super admin (all venues) or partner owner/manager (scoped venues).
 * Super-admin mutations may set org/lock; partners may only edit venue content fields.
 */
@Controller('admin/venues')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminVenueController {
  constructor(
    private readonly venues: VenueService,
    private readonly cmsAccess: AdminCmsAccessService,
  ) {}

  @Get()
  async list(@Req() req: ReqWithScope) {
    const scope = getAdminCmsScope(req);
    const rows = await this.venues.listForAdminCms(scope);
    return rows.map((v) => this.venues.sanitizeVenueForAdmin(v));
  }

  @Get(':id')
  async get(@Req() req: ReqWithScope, @Param('id') id: string) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, id);
    const v = await this.venues.findOne(id);
    return this.venues.sanitizeVenueForAdmin(v);
  }

  @Post()
  create(@Req() req: ReqWithScope, @Body() dto: CreateVenueDto) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertSuperAdmin(scope);
    return this.venues.create(dto);
  }

  @Patch(':id')
  update(@Req() req: ReqWithScope, @Param('id') id: string, @Body() dto: AdminPatchVenueDto) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, id);
    if (scope.kind === 'partner') {
      const {
        organizationId: _o,
        locked: _l,
        lockReason: _r,
        ...rest
      } = dto as AdminPatchVenueDto & Record<string, unknown>;
      void _o;
      void _l;
      void _r;
      const partnerDto = rest as AdminPatchVenueDto;
      return this.venues.updateForAdmin(id, partnerDto);
    }
    return this.venues.updateForAdmin(id, dto);
  }
}
