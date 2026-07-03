import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { VenueReceiptController } from './venue-receipt.controller';
import { VenueReceiptService } from './venue-receipt.service';
import { VenueModule } from '../venue/venue.module';
import { NotificationModule } from '../notification/notification.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [PrismaModule, AuthModule, PlayerModule, VenueModule, NotificationModule, StaffModule],
  controllers: [VenueReceiptController],
  providers: [VenueReceiptService],
  exports: [VenueReceiptService],
})
export class ReceiptModule {}
