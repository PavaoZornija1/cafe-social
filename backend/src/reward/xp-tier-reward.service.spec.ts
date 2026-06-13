import { XP_TIER_SILVER } from '../lib/xp-rewards';
import { XpTierRewardService } from './xp-tier-reward.service';
import { PlatformAutomatedRewardService } from './platform-automated-reward.service';

describe('XpTierRewardService', () => {
  let service: XpTierRewardService;
  let prisma: {
    playerVenueStats: { aggregate: jest.Mock };
    player: { findUnique: jest.Mock };
    platformAutomatedReward: { findMany: jest.Mock };
  };
  let platformRewards: { tryGrantForKey: jest.Mock };

  beforeEach(() => {
    prisma = {
      playerVenueStats: { aggregate: jest.fn() },
      player: { findUnique: jest.fn() },
      platformAutomatedReward: { findMany: jest.fn() },
    };
    platformRewards = { tryGrantForKey: jest.fn().mockResolvedValue({ ok: true }) };
    service = new XpTierRewardService(
      prisma as never,
      platformRewards as unknown as PlatformAutomatedRewardService,
    );
  });

  it('grants CMS tier rules when lifetime XP meets threshold', async () => {
    prisma.playerVenueStats.aggregate.mockResolvedValue({ _sum: { venueXp: XP_TIER_SILVER } });
    prisma.player.findUnique.mockResolvedValue({ bonusXp: 0 });
    prisma.platformAutomatedReward.findMany.mockResolvedValue([
      { rewardKey: 'tier.silver', minLifetimeXp: XP_TIER_SILVER },
    ]);

    await service.syncTierRewards('player-1');

    expect(platformRewards.tryGrantForKey).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-1',
        rewardKey: 'tier.silver',
        sourceType: 'TIER',
      }),
    );
  });

  it('skips tier rules below threshold', async () => {
    prisma.playerVenueStats.aggregate.mockResolvedValue({ _sum: { venueXp: 100 } });
    prisma.player.findUnique.mockResolvedValue({ bonusXp: 0 });
    prisma.platformAutomatedReward.findMany.mockResolvedValue([
      { rewardKey: 'tier.silver', minLifetimeXp: XP_TIER_SILVER },
    ]);

    await service.syncTierRewards('player-1');

    expect(platformRewards.tryGrantForKey).not.toHaveBeenCalled();
  });
});
