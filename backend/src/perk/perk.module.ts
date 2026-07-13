import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { VenuePerkController } from './venue-perk.controller';
import { VenuePerkService } from './venue-perk.service';
import { PerkExpiryReminderScheduler } from './perk-expiry-reminder.scheduler';
import { VenueModule } from '../venue/venue.module';
import { VenueStaffModule } from '../venue-staff/venue-staff.module';

@Module({
  imports: [
    ScheduleModule,
    PrismaModule,
    PlayerModule,
    AuthModule,
    VenueModule,
    VenueStaffModule,
    PushModule,
  ],
  controllers: [VenuePerkController],
  providers: [VenuePerkService, PerkExpiryReminderScheduler],
  exports: [VenuePerkService],
})
export class PerkModule {}
