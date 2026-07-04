import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WordController } from './word.controller';
import { WordService } from './word.service';
import { WordRepository } from './word.repository';
import { WordMatchController } from './word-match.controller';
import { WordMatchService } from './word-match.service';
import { WordMatchLiveRedisService } from './word-match-live-redis.service';
import { WordMatchGateway } from './word-match.gateway';
import { WordMatchCleanupService } from './word-match-cleanup.service';
import { DailyWordController } from './daily-word.controller';
import { DailyWordService } from './daily-word.service';
import { DailyWordStreakAtRiskScheduler } from './daily-word-streak-at-risk.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { VenueFeedModule } from '../venue-feed/venue-feed.module';
import { VenueModule } from '../venue/venue.module';
import { StatsModule } from '../stats/stats.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { PostGameModule } from '../post-game/post-game.module';

@Module({
  imports: [
    ScheduleModule,
    PrismaModule,
    PlayerModule,
    AuthModule,
    PushModule,
    VenueFeedModule,
    VenueModule,
    StatsModule,
    ChallengeModule,
    PostGameModule,
  ],
  controllers: [WordController, WordMatchController, DailyWordController],
  providers: [
    WordService,
    WordRepository,
    WordMatchService,
    WordMatchLiveRedisService,
    WordMatchGateway,
    WordMatchCleanupService,
    DailyWordService,
    DailyWordStreakAtRiskScheduler,
  ],
  exports: [WordMatchService],
})
export class WordModule {}

