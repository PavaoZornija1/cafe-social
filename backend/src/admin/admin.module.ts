import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerModule } from '../player/player.module';
import { VenueStaffModule } from '../venue-staff/venue-staff.module';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminVenueController } from './admin-venue.controller';
import { AdminVenueStaffController } from './admin-venue-staff.controller';
import { AdminWordController } from './admin-word.controller';
import { AdminChallengeController } from './admin-challenge.controller';
import { AdminPerkController } from './admin-perk.controller';

@Module({
  imports: [PrismaModule, VenueModule, PlayerModule, VenueStaffModule],
  controllers: [
    AdminVenueController,
    AdminVenueStaffController,
    AdminWordController,
    AdminChallengeController,
    AdminPerkController,
  ],
  providers: [AdminApiKeyGuard],
})
export class AdminModule {}
