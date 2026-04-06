import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerModule } from '../player/player.module';
import { VenueStaffModule } from '../venue-staff/venue-staff.module';
import { StripeModule } from '../stripe/stripe.module';
import { AdminVenueController } from './admin-venue.controller';
import { AdminOrganizationController } from './admin-organization.controller';
import { AdminVenueStaffController } from './admin-venue-staff.controller';
import { AdminWordController } from './admin-word.controller';
import { AdminChallengeController } from './admin-challenge.controller';
import { AdminPerkController } from './admin-perk.controller';
import { AdminVenueOfferController } from './admin-venue-offer.controller';
import { AdminVenueTypeController } from './admin-venue-type.controller';
import { AdminNudgeTemplateController } from './admin-nudge-template.controller';
import { AdminVenueNudgeController } from './admin-venue-nudge.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { AdminCmsAccessService } from './admin-cms-access.service';
import { AdminCmsGuard } from './admin-cms.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    VenueModule,
    PlayerModule,
    VenueStaffModule,
    StripeModule,
  ],
  controllers: [
    AdminVenueController,
    AdminDashboardController,
    AdminOrganizationController,
    AdminVenueStaffController,
    AdminWordController,
    AdminChallengeController,
    AdminPerkController,
    AdminVenueOfferController,
    AdminVenueTypeController,
    AdminNudgeTemplateController,
    AdminVenueNudgeController,
  ],
  providers: [
    PlatformSuperAdminGuard,
    AdminCmsAccessService,
    AdminCmsGuard,
  ],
})
export class AdminModule {}
