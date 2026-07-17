import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { VenueModule } from '../venue/venue.module';
import { BrawlerController } from './brawler.controller';
import { BrawlerService } from './brawler.service';
import { BrawlerRepository } from './brawler.repository';
import { BrawlerLiveRedisService } from './brawler-live-redis.service';
import { BrawlerArenaRedisService } from './brawler-arena-redis.service';
import { BrawlerCombatRedisService } from './brawler-combat-redis.service';
import { BrawlerCombatSimService } from './brawler-combat-sim.service';
import { BrawlerGateway } from './brawler.gateway';
import { BrawlerCleanupService } from './brawler-cleanup.service';
import { StatsModule } from '../stats/stats.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { PostGameModule } from '../post-game/post-game.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule, VenueModule, StatsModule, ChallengeModule, PostGameModule, PushModule],
  controllers: [BrawlerController],
  providers: [
    BrawlerService,
    BrawlerRepository,
    BrawlerLiveRedisService,
    BrawlerArenaRedisService,
    BrawlerCombatRedisService,
    BrawlerCombatSimService,
    BrawlerGateway,
    BrawlerCleanupService,
  ],
  exports: [BrawlerService],
})
export class BrawlerModule {}

