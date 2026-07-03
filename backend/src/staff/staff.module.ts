import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialModule } from '../social/social.module';
import { VenueModule } from '../venue/venue.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { OwnerRedemptionActionsService } from '../owner/owner-redemption-actions.service';
import { PlayerMemberScanService } from './player-member-scan.service';
import { StaffRedemptionsService } from './staff-redemptions.service';

@Module({
  imports: [PrismaModule, VenueModule, ChallengeModule, forwardRef(() => SocialModule)],
  providers: [StaffRedemptionsService, PlayerMemberScanService, OwnerRedemptionActionsService],
  exports: [StaffRedemptionsService, PlayerMemberScanService, OwnerRedemptionActionsService],
})
export class StaffModule {}
