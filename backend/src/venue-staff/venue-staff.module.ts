import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { VenueStaffService } from './venue-staff.service';
import { VenueStaffGuard } from './venue-staff.guard';
import { VenueStaffInviteService } from './venue-staff-invite.service';
import { OrganizationStaffGuard } from './organization-staff.guard';

@Module({
  imports: [PrismaModule, AuthModule, PlayerModule],
  providers: [
    VenueStaffService,
    VenueStaffGuard,
    VenueStaffInviteService,
    OrganizationStaffGuard,
  ],
  exports: [
    VenueStaffService,
    VenueStaffGuard,
    VenueStaffInviteService,
    OrganizationStaffGuard,
  ],
})
export class VenueStaffModule {}
