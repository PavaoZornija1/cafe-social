import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RewardModule } from '../reward/reward.module';
import { VenueStaffCoreModule } from '../venue-staff/venue-staff-core.module';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';
import { GameXpAwardService } from './game-xp-award.service';

@Module({
  // VenueStaffCoreModule (not VenueStaffModule) avoids the
  // stats -> venue-staff -> player -> stats cycle.
  imports: [PrismaModule, VenueStaffCoreModule, forwardRef(() => RewardModule)],
  providers: [PlayerVenueStatsRepository, GameXpAwardService],
  exports: [PlayerVenueStatsRepository, GameXpAwardService],
})
export class StatsModule {}
