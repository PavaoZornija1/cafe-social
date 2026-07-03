import { Module, forwardRef } from '@nestjs/common';
import { ChallengeController } from './challenge.controller';
import { ChallengeRepository } from './challenge.repository';
import { ChallengeService } from './challenge.service';
import { PlayerModule } from '../player/player.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StatsModule } from '../stats/stats.module';
import { VenueModule } from '../venue/venue.module';
import { RewardModule } from '../reward/reward.module';

@Module({
  imports: [
    PrismaModule,
    PlayerModule,
    AuthModule,
    StatsModule,
    forwardRef(() => VenueModule),
    forwardRef(() => RewardModule),
  ],
  controllers: [ChallengeController],
  providers: [ChallengeRepository, ChallengeService],
  exports: [ChallengeRepository, ChallengeService],
})
export class ChallengeModule {}
