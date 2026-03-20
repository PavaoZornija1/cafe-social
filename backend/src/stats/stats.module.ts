import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';

@Module({
  imports: [PrismaModule],
  providers: [PlayerVenueStatsRepository],
  exports: [PlayerVenueStatsRepository],
})
export class StatsModule {}
