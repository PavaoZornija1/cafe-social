import {
  BadRequestException,
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
import { Prisma } from '@prisma/client';
import { VenueOfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import type { AdminCmsScope } from './admin-cms-access.service';
import { AdminCmsAccessService } from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };

class AdminCreateVenueOfferDto {
  title!: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaUrl?: string | null;
  status?: VenueOfferStatus;
  isFeatured?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  maxRedemptions?: number | null;
  maxRedemptionsPerPlayer?: number | null;
}

class AdminPatchVenueOfferDto {
  title?: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaUrl?: string | null;
  status?: VenueOfferStatus;
  isFeatured?: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  maxRedemptions?: number | null;
  maxRedemptionsPerPlayer?: number | null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminVenueOfferController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cmsAccess: AdminCmsAccessService,
  ) {}

  @Get('venues/:venueId/offers')
  list(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    return this.prisma.venueOffer.findMany({
      where: { venueId },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Post('venues/:venueId/offers')
  async create(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: AdminCreateVenueOfferDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const title = dto.title?.trim() ?? '';
    if (!title) throw new BadRequestException('title is required');

    const status = dto.status ?? VenueOfferStatus.DRAFT;
    const isFeatured = dto.isFeatured ?? false;

    return this.prisma.$transaction(async (tx) => {
      if (isFeatured) {
        await tx.venueOffer.updateMany({
          where: { venueId },
          data: { isFeatured: false },
        });
      }
      return tx.venueOffer.create({
        data: {
          venueId,
          title,
          body: dto.body?.trim() || null,
          imageUrl: dto.imageUrl?.trim() || null,
          ctaUrl: dto.ctaUrl?.trim() || null,
          status,
          isFeatured,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
          validTo: dto.validTo ? new Date(dto.validTo) : null,
          maxRedemptions: dto.maxRedemptions ?? null,
          maxRedemptionsPerPlayer: dto.maxRedemptionsPerPlayer ?? null,
        },
      });
    });
  }

  @Patch('venues/:venueId/offers/:offerId')
  async patch(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
    @Body() dto: AdminPatchVenueOfferDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const existing = await this.prisma.venueOffer.findFirst({
      where: { id: offerId, venueId },
    });
    if (!existing) throw new NotFoundException('Offer not found');

    const title =
      dto.title !== undefined ? dto.title.trim() : undefined;
    if (title !== undefined && !title) {
      throw new BadRequestException('title cannot be empty');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isFeatured === true) {
        await tx.venueOffer.updateMany({
          where: { venueId, NOT: { id: offerId } },
          data: { isFeatured: false },
        });
      }

      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (dto.body !== undefined) data.body = dto.body?.trim() || null;
      if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl?.trim() || null;
      if (dto.ctaUrl !== undefined) data.ctaUrl = dto.ctaUrl?.trim() || null;
      if (dto.status !== undefined) data.status = dto.status;
      if (dto.isFeatured !== undefined) data.isFeatured = dto.isFeatured;
      if (dto.validFrom !== undefined)
        data.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
      if (dto.validTo !== undefined)
        data.validTo = dto.validTo ? new Date(dto.validTo) : null;
      if (dto.maxRedemptions !== undefined) data.maxRedemptions = dto.maxRedemptions;
      if (dto.maxRedemptionsPerPlayer !== undefined)
        data.maxRedemptionsPerPlayer = dto.maxRedemptionsPerPlayer;

      return tx.venueOffer.update({
        where: { id: offerId },
        data: data as Prisma.VenueOfferUpdateInput,
      });
    });
  }

  @Delete('venues/:venueId/offers/:offerId')
  async remove(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('offerId', new ParseUUIDPipe()) offerId: string,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    const existing = await this.prisma.venueOffer.findFirst({
      where: { id: offerId, venueId },
    });
    if (!existing) throw new NotFoundException('Offer not found');
    return this.prisma.venueOffer.delete({ where: { id: offerId } });
  }
}
