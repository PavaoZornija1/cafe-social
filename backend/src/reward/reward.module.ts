import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerRewardGrantService } from './player-reward-grant.service';

@Module({
  imports: [PrismaModule, VenueModule],
  providers: [PlayerRewardGrantService],
  exports: [PlayerRewardGrantService],
})
export class RewardModule {}
