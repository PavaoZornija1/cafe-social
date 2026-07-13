import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { NotificationModule } from '../notification/notification.module';
import { VenueStaffModule } from '../venue-staff/venue-staff.module';
import { PlayerRewardGrantService } from './player-reward-grant.service';
import { PlatformAutomatedRewardService } from './platform-automated-reward.service';
import { XpTierRewardService } from './xp-tier-reward.service';

@Module({
  imports: [PrismaModule, forwardRef(() => VenueModule), NotificationModule, VenueStaffModule],
  providers: [PlayerRewardGrantService, PlatformAutomatedRewardService, XpTierRewardService],
  exports: [PlayerRewardGrantService, PlatformAutomatedRewardService, XpTierRewardService],
})
export class RewardModule {}
