import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';

class UpsertPlatformAutomatedRewardDto {
  perkId?: string | null;
  label?: string | null;
  minLifetimeXp?: number | null;
  isActive?: boolean;
}

@Controller('admin/platform-automated-rewards')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminPlatformAutomatedRewardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.platformAutomatedReward.findMany({
      include: {
        perk: {
          select: {
            id: true,
            code: true,
            title: true,
            venueId: true,
            venue: { select: { name: true } },
          },
        },
      },
      orderBy: { rewardKey: 'asc' },
    });
  }

  @Put(':rewardKey')
  async upsert(@Param('rewardKey') rewardKey: string, @Body() body: UpsertPlatformAutomatedRewardDto) {
    if (body.perkId) {
      const perk = await this.prisma.venuePerk.findUnique({ where: { id: body.perkId } });
      if (!perk) throw new NotFoundException('Perk not found');
    }

    const row = await this.prisma.platformAutomatedReward.upsert({
      where: { rewardKey },
      update: {
        perkId: body.perkId ?? null,
        label: body.label ?? null,
        minLifetimeXp: body.minLifetimeXp ?? null,
        isActive: body.isActive ?? true,
      },
      create: {
        rewardKey,
        perkId: body.perkId ?? null,
        label: body.label ?? null,
        minLifetimeXp: body.minLifetimeXp ?? null,
        isActive: body.isActive ?? true,
      },
      include: {
        perk: { select: { id: true, code: true, title: true, venueId: true } },
      },
    });

    return row;
  }
}
