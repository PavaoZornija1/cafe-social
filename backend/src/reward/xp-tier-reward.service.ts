import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformAutomatedRewardService } from './platform-automated-reward.service';

@Injectable()
export class XpTierRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformRewards: PlatformAutomatedRewardService,
  ) {}

  /** Sum venue XP + bonus XP — same formula as player summary. */
  async totalXpFor(playerId: string): Promise<number> {
    const [venueAgg, player] = await Promise.all([
      this.prisma.playerVenueStats.aggregate({
        where: { playerId },
        _sum: { venueXp: true },
      }),
      this.prisma.player.findUnique({
        where: { id: playerId },
        select: { bonusXp: true },
      }),
    ]);
    return (venueAgg._sum.venueXp ?? 0) + (player?.bonusXp ?? 0);
  }

  /** Idempotent tier perk grants from CMS rules that link a perk. */
  async syncTierRewards(playerId: string): Promise<void> {
    const totalXp = await this.totalXpFor(playerId);
    const tierRules = await this.prisma.platformAutomatedReward.findMany({
      where: {
        isActive: true,
        minLifetimeXp: { not: null },
        perkId: { not: null },
        rewardKey: { startsWith: 'tier.' },
      },
      select: { rewardKey: true, minLifetimeXp: true },
    });

    for (const rule of tierRules) {
      const threshold = rule.minLifetimeXp;
      if (threshold == null || totalXp < threshold) continue;

      await this.platformRewards.tryGrantForKey({
        playerId,
        rewardKey: rule.rewardKey,
        sourceType: 'TIER',
        sourceId: rule.rewardKey,
        idempotencyKey: `${rule.rewardKey}:${playerId}`,
      });
    }
  }
}
