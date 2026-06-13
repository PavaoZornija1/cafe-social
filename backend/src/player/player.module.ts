import { Module, forwardRef } from '@nestjs/common';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { PlayerRepository } from './player.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StatsModule } from '../stats/stats.module';
import { PushModule } from '../push/push.module';
import { VenueModule } from '../venue/venue.module';
import { RewardModule } from '../reward/reward.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StatsModule,
    PushModule,
    forwardRef(() => StatsModule),
    forwardRef(() => RewardModule),
    forwardRef(() => VenueModule),
  ],
  controllers: [PlayerController],
  providers: [PlayerService, PlayerRepository],
  exports: [PlayerService],
})
export class PlayerModule {}

