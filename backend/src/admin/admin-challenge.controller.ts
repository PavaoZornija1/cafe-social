import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';

class AdminPatchChallengeDto {
  title?: string;
  description?: string | null;
  rewardVenueSpecific?: boolean;
  locationRequired?: boolean;
  targetCount?: number;
  resetsWeekly?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminChallengeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('venues/:venueId/challenges')
  listForVenue(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.prisma.challenge.findMany({
      where: { venueId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Patch('challenges/:id')
  patch(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: AdminPatchChallengeDto) {
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
      },
    });
  }
}
