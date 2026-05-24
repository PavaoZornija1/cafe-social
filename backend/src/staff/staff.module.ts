import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialModule } from '../social/social.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerMemberScanService } from './player-member-scan.service';
import { StaffRedemptionsService } from './staff-redemptions.service';

@Module({
  imports: [PrismaModule, VenueModule, SocialModule],
  providers: [StaffRedemptionsService, PlayerMemberScanService],
  exports: [StaffRedemptionsService, PlayerMemberScanService],
})
export class StaffModule {}
