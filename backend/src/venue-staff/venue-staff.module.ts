import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { VenueStaffCoreModule } from './venue-staff-core.module';
import { VenueStaffGuard } from './venue-staff.guard';
import { VenueStaffInviteService } from './venue-staff-invite.service';
import { OrganizationStaffGuard } from './organization-staff.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    VenueStaffCoreModule,
    forwardRef(() => PlayerModule),
  ],
  providers: [
    VenueStaffGuard,
    VenueStaffInviteService,
    OrganizationStaffGuard,
  ],
  exports: [
    VenueStaffCoreModule,
    VenueStaffGuard,
    VenueStaffInviteService,
    OrganizationStaffGuard,
  ],
})
export class VenueStaffModule {}
