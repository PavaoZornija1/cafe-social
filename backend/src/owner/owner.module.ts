import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    PlayerModule,
    VenueStaffModule,
    StaffModule,
    PushModule,
    ReceiptModule,
  ],
  controllers: [OwnerController],
  providers: [
    OwnerAnalyticsService,
    OwnerCampaignService,
    OwnerRedemptionActionsService,
  ],
})
export class OwnerModule {}
