import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
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

class AdminPatchChallengeDto {
  title?: string;
  description?: string | null;
  rewardVenueSpecific?: boolean;
  locationRequired?: boolean;
  targetCount?: number;
  resetsWeekly?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
  /** Set to `null` to clear. Must reference a perk for the same venue as the challenge. */
  rewardPerkId?: string | null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminChallengeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cmsAccess: AdminCmsAccessService,
  ) {}

  @Get('venues/:venueId/challenges')
  listForVenue(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);
    return this.prisma.challenge.findMany({
      where: { venueId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Patch('challenges/:id')
  async patch(
    @Req() req: ReqWithScope,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdminPatchChallengeDto,
  ) {
    const scope = getAdminCmsScope(req);
    const row = await this.prisma.challenge.findUnique({
      where: { id },
      select: { venueId: true },
    });
    if (!row) throw new NotFoundException('Challenge not found');
    this.cmsAccess.assertVenueInScope(scope, row.venueId);

    if (dto.rewardPerkId !== undefined && dto.rewardPerkId !== null) {
      const perk = await this.prisma.venuePerk.findFirst({
        where: { id: dto.rewardPerkId, venueId: row.venueId },
        select: { id: true },
      });
      if (!perk) {
        throw new BadRequestException('rewardPerkId must be a perk belonging to this challenge venue');
      }
    }

    return this.prisma.challenge.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rewardVenueSpecific !== undefined && {
          rewardVenueSpecific: dto.rewardVenueSpecific,
        }),
        ...(dto.locationRequired !== undefined && { locationRequired: dto.locationRequired }),
        ...(dto.targetCount !== undefined && { targetCount: dto.targetCount }),
        ...(dto.resetsWeekly !== undefined && { resetsWeekly: dto.resetsWeekly }),
        ...(dto.activeFrom !== undefined && {
          activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        }),
        ...(dto.activeTo !== undefined && {
          activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        }),
        ...(dto.rewardPerkId !== undefined && { rewardPerkId: dto.rewardPerkId }),
      },
    });
  }
}
