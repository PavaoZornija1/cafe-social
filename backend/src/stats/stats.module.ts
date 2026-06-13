import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardModule } from '../reward/reward.module';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';
import { GameXpAwardService } from './game-xp-award.service';

@Module({
  imports: [PrismaModule, forwardRef(() => RewardModule)],
  providers: [PlayerVenueStatsRepository, GameXpAwardService],
  exports: [PlayerVenueStatsRepository, GameXpAwardService],
})
export class StatsModule {}
