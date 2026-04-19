import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerVenueStatsRepository } from './player-venue-stats.repository';
import { GameXpAwardService } from './game-xp-award.service';

@Module({
  imports: [PrismaModule],
  providers: [PlayerVenueStatsRepository, GameXpAwardService],
  exports: [PlayerVenueStatsRepository, GameXpAwardService],
})
export class StatsModule {}
