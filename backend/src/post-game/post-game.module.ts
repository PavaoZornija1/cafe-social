import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StatsModule } from '../stats/stats.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { RewardModule } from '../reward/reward.module';
import { PlatformQuestModule } from '../platform-quest/platform-quest.module';
import { PostGameService } from './post-game.service';

@Module({
  imports: [PrismaModule, StatsModule, ChallengeModule, RewardModule, PlatformQuestModule],
  providers: [PostGameService],
  exports: [PostGameService],
})
export class PostGameModule {}
