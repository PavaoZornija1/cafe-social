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
import {
  ChallengeAutoProgressSource,
  ChallengeScheduleType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import type { AdminCmsScope } from './admin-cms-access.service';
import { AdminCmsAccessService } from './admin-cms-access.service';
import { AdminCmsGuard, getAdminCmsScope } from './admin-cms.guard';

type ReqWithScope = Request & { adminCmsScope?: AdminCmsScope };

class AdminCreateChallengeDto {
  title!: string;
  description?: string | null;
  autoProgressSource?: ChallengeAutoProgressSource;
  rewardVenueSpecific?: boolean;
  locationRequired?: boolean;
  targetCount?: number;
  resetsWeekly?: boolean;
  scheduleType?: ChallengeScheduleType;
  activeFrom?: string | null;
  activeTo?: string | null;
  dailyStartMinutes?: number | null;
  dailyEndMinutes?: number | null;
  requiresWin?: boolean;
  rewardPerkId?: string | null;
}

class AdminPatchChallengeDto extends AdminCreateChallengeDto {}

function validateSchedule(dto: {
  scheduleType?: ChallengeScheduleType;
  activeFrom?: string | null;
  activeTo?: string | null;
  dailyStartMinutes?: number | null;
  dailyEndMinutes?: number | null;
}) {
  const scheduleType = dto.scheduleType ?? ChallengeScheduleType.ALWAYS;
  if (scheduleType === ChallengeScheduleType.DAILY_RECURRING) {
    const start = dto.dailyStartMinutes;
    const end = dto.dailyEndMinutes;
    if (start == null || end == null) {
      throw new BadRequestException(
        'dailyStartMinutes and dailyEndMinutes are required for DAILY_RECURRING challenges',
      );
    }
    if (start < 0 || start > 1439 || end < 0 || end > 1439) {
      throw new BadRequestException('daily minutes must be between 0 and 1439');
    }
  }
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
      include: {
        rewardPerk: { select: { id: true, title: true, code: true } },
      },
    });
  }

  @Post('venues/:venueId/challenges')
  async create(
    @Req() req: ReqWithScope,
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: AdminCreateChallengeDto,
  ) {
    const scope = getAdminCmsScope(req);
    this.cmsAccess.assertVenueInScope(scope, venueId);

    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('title is required');

    validateSchedule(dto);

    if (dto.rewardPerkId) {
      await this.assertPerkForVenue(dto.rewardPerkId, venueId);
    }

    const targetCount = dto.targetCount ?? 1;
    if (targetCount < 1) throw new BadRequestException('targetCount must be >= 1');

    return this.prisma.challenge.create({
      data: {
        venueId,
        title,
        description: dto.description?.trim() || null,
        autoProgressSource: dto.autoProgressSource ?? ChallengeAutoProgressSource.WORD_MATCH,
        rewardVenueSpecific: dto.rewardVenueSpecific ?? true,
        locationRequired: dto.locationRequired ?? false,
        targetCount,
        resetsWeekly: dto.resetsWeekly ?? false,
        scheduleType: dto.scheduleType ?? ChallengeScheduleType.ALWAYS,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        dailyStartMinutes: dto.dailyStartMinutes ?? null,
        dailyEndMinutes: dto.dailyEndMinutes ?? null,
        requiresWin: dto.requiresWin ?? false,
        rewardPerkId: dto.rewardPerkId ?? null,
      },
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
      select: { venueId: true, scheduleType: true },
    });
    if (!row) throw new NotFoundException('Challenge not found');
    this.cmsAccess.assertVenueInScope(scope, row.venueId);

    validateSchedule({
      scheduleType: dto.scheduleType ?? row.scheduleType,
      activeFrom: dto.activeFrom,
      activeTo: dto.activeTo,
      dailyStartMinutes: dto.dailyStartMinutes,
      dailyEndMinutes: dto.dailyEndMinutes,
    });

    if (dto.rewardPerkId !== undefined && dto.rewardPerkId !== null) {
      await this.assertPerkForVenue(dto.rewardPerkId, row.venueId);
    }

    if (dto.targetCount !== undefined && dto.targetCount < 1) {
      throw new BadRequestException('targetCount must be >= 1');
    }

    const data: Prisma.ChallengeUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.autoProgressSource !== undefined && { autoProgressSource: dto.autoProgressSource }),
      ...(dto.rewardVenueSpecific !== undefined && {
        rewardVenueSpecific: dto.rewardVenueSpecific,
      }),
      ...(dto.locationRequired !== undefined && { locationRequired: dto.locationRequired }),
      ...(dto.targetCount !== undefined && { targetCount: dto.targetCount }),
      ...(dto.resetsWeekly !== undefined && { resetsWeekly: dto.resetsWeekly }),
      ...(dto.scheduleType !== undefined && { scheduleType: dto.scheduleType }),
      ...(dto.activeFrom !== undefined && {
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
      }),
      ...(dto.activeTo !== undefined && {
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
      }),
      ...(dto.dailyStartMinutes !== undefined && { dailyStartMinutes: dto.dailyStartMinutes }),
      ...(dto.dailyEndMinutes !== undefined && { dailyEndMinutes: dto.dailyEndMinutes }),
      ...(dto.requiresWin !== undefined && { requiresWin: dto.requiresWin }),
      ...(dto.rewardPerkId !== undefined && { rewardPerkId: dto.rewardPerkId }),
    };

    return this.prisma.challenge.update({ where: { id }, data });
  }

  @Delete('challenges/:id')
  async remove(@Req() req: ReqWithScope, @Param('id', new ParseUUIDPipe()) id: string) {
    const scope = getAdminCmsScope(req);
    const row = await this.prisma.challenge.findUnique({
      where: { id },
      select: { venueId: true },
    });
    if (!row) throw new NotFoundException('Challenge not found');
    this.cmsAccess.assertVenueInScope(scope, row.venueId);
    await this.prisma.challengeProgress.deleteMany({ where: { challengeId: id } });
    return this.prisma.challenge.delete({ where: { id } });
  }

  private async assertPerkForVenue(perkId: string, venueId: string) {
    const perk = await this.prisma.venuePerk.findFirst({
      where: { id: perkId, venueId },
      select: { id: true },
    });
    if (!perk) {
      throw new BadRequestException('rewardPerkId must be a perk belonging to this challenge venue');
    }
  }
}
