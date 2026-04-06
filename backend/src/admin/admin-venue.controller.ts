import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { PrismaService } from '../prisma/prisma.service';

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
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @Req() req: ReqWithScope,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('search') search?: string,
    @Query('location') location?: string,
    @Query('lockedOnly') lockedOnlyRaw?: string,
    @Query('organizationId') organizationId?: string,
    @Query('countries') countriesRaw?: string,
  ) {
    const scope = getAdminCmsScope(req);
    const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw ?? '25', 10) || 25));
    const lockedOnly = lockedOnlyRaw === 'true' || lockedOnlyRaw === '1';

    const orgId = organizationId?.trim() ?? '';
    if (orgId && orgId !== '__none__' && !/^[0-9a-f-]{36}$/i.test(orgId)) {
      throw new BadRequestException('organizationId must be a UUID or __none__');
    }

    const countries =
      scope.kind === 'super_admin' && countriesRaw && countriesRaw.trim().length > 0
        ? countriesRaw
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean)
        : undefined;

    return this.venues.listForAdminCmsPaginated(scope, {
      page,
      limit,
      search: search?.trim() || undefined,
      location: location?.trim() || undefined,
      lockedOnly,
      organizationId: orgId || undefined,
      countries,
    });
  }

  @Get(':id')
  async get(@Req() req: ReqWithScope, @Param('id') id: string) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, id);
    const { venue, organization } = await this.venues.findOneWithOrgForAdmin(id);
    const vtypes = await this.prisma.venueVenueType.findMany({
      where: { venueId: id },
      include: { venueType: { select: { id: true, code: true, label: true } } },
    });
    return {
      ...this.venues.sanitizeVenueForAdmin(venue),
      organization,
      venueTypes: vtypes.map((x) => x.venueType),
    };
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
