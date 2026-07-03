import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import type { AdminCmsScope } from './admin-cms-access.service';
import { AdminCmsAccessService } from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };

class AdminCreatePerkDto {
  code!: string;
  title!: string;
  subtitle?: string;
  body?: string;
  requiresQrUnlock?: boolean;
  autoRedeem?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
  maxRedemptions?: number | null;
}

class AdminPatchPerkDto {
  title?: string;
  subtitle?: string | null;
  body?: string | null;
  requiresQrUnlock?: boolean;
  autoRedeem?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
  maxRedemptions?: number | null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminPerkController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cmsAccess: AdminCmsAccessService,
  ) {}

  @Get('venues/:venueId/perks')
  list(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    return this.prisma.venuePerk.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('venues/:venueId/perks')
  create(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: AdminCreatePerkDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '');
    return this.prisma.venuePerk.create({
      data: {
        venueId,
        code,
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        body: dto.body?.trim() || null,
        requiresQrUnlock: dto.requiresQrUnlock ?? false,
        autoRedeem: dto.autoRedeem ?? false,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        maxRedemptions: dto.maxRedemptions ?? null,
      },
    });
  }

  @Patch('perks/:id')
  async patch(
    @Req() req: ReqWithScope,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminPatchPerkDto,
  ) {
    const scope = getAdminCmsScope(req);
    const perk = await this.prisma.venuePerk.findUnique({
      where: { id },
      select: { venueId: true },
    });
    if (!perk) throw new NotFoundException('Perk not found');
    this.cmsAccess.assertVenueInScope(scope, perk.venueId);
    return this.prisma.venuePerk.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.subtitle !== undefined && { subtitle: dto.subtitle?.trim() || null }),
        ...(dto.body !== undefined && { body: dto.body?.trim() || null }),
        ...(dto.requiresQrUnlock !== undefined && { requiresQrUnlock: dto.requiresQrUnlock }),
        ...(dto.autoRedeem !== undefined && { autoRedeem: dto.autoRedeem }),
        ...(dto.activeFrom !== undefined && {
          activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        }),
        ...(dto.activeTo !== undefined && {
          activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        }),
        ...(dto.maxRedemptions !== undefined && { maxRedemptions: dto.maxRedemptions }),
      },
    });
  }

  @Delete('perks/:id')
  async remove(@Req() req: ReqWithScope, @Param('id', new ParseUUIDPipe()) id: string) {
    const scope = getAdminCmsScope(req);
    const perk = await this.prisma.venuePerk.findUnique({
      where: { id },
      select: { venueId: true },
    });
    if (!perk) throw new NotFoundException('Perk not found');
    this.cmsAccess.assertVenueInScope(scope, perk.venueId);
    return this.prisma.venuePerk.delete({ where: { id } });
  }
}
