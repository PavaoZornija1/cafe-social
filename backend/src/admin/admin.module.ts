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
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';

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
    AdminOrganizationController,
    AdminVenueStaffController,
    AdminWordController,
    AdminChallengeController,
    AdminPerkController,
  ],
  providers: [PlatformSuperAdminGuard],
})
export class AdminModule {}
