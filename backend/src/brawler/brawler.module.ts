import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { VenueModule } from '../venue/venue.module';
import { BrawlerController } from './brawler.controller';
import { BrawlerService } from './brawler.service';
import { BrawlerRepository } from './brawler.repository';
import { StatsModule } from '../stats/stats.module';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule, VenueModule, StatsModule],
  controllers: [BrawlerController],
  providers: [BrawlerService, BrawlerRepository],
})
export class BrawlerModule {}

