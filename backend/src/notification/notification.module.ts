import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PushModule } from '../push/push.module';
import { PlayerNotificationService } from './player-notification.service';
import { VenueStaffNotificationService } from './venue-staff-notification.service';

@Module({
  imports: [PrismaModule, PushModule],
  providers: [PlayerNotificationService, VenueStaffNotificationService],
  exports: [PlayerNotificationService, VenueStaffNotificationService],
})
export class NotificationModule {}
