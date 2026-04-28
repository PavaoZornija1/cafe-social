import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { PlayerModule } from '../player/player.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { StaffModule } from '../staff/staff.module';
import { VenueStaffModule } from '../venue-staff/venue-staff.module';
import { OwnerAnalyticsService } from './owner-analytics.service';
import { OwnerCampaignService } from './owner-campaign.service';
import { OwnerRedemptionActionsService } from './owner-redemption-actions.service';
import { OwnerController } from './owner.controller';
import { PartnerOrgAccessService } from './partner-org-access.service';
import { PartnerOnboardingService } from './partner-onboarding.service';
import { OwnerOrganizationVenueService } from './owner-organization-venue.service';
import { PartnerVenueWriteGuard } from './partner-venue-write.guard';
import { PartnerOpsListener } from './partner-ops.listener';
import { PartnerOnboardingThrottlerFilter } from './partner-onboarding-throttle.filter';
import { VenueModule } from '../venue/venue.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    PlayerModule,
    VenueStaffModule,
    VenueModule,
    StaffModule,
    PushModule,
    ReceiptModule,
    forwardRef(() => StripeModule),
  ],
  controllers: [OwnerController],
  providers: [
    OwnerAnalyticsService,
    OwnerCampaignService,
    OwnerRedemptionActionsService,
    PartnerOrgAccessService,
    PartnerOnboardingService,
    OwnerOrganizationVenueService,
    PartnerVenueWriteGuard,
    PartnerOpsListener,
    PartnerOnboardingThrottlerFilter,
  ],
  exports: [PartnerOrgAccessService],
})
export class OwnerModule {}
