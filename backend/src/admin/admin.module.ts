import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminVenueController } from './admin-venue.controller';
import { AdminWordController } from './admin-word.controller';
import { AdminChallengeController } from './admin-challenge.controller';
import { AdminPerkController } from './admin-perk.controller';

@Module({
  imports: [PrismaModule, VenueModule],
  controllers: [
    AdminVenueController,
    AdminWordController,
    AdminChallengeController,
    AdminPerkController,
  ],
  providers: [AdminApiKeyGuard],
})
export class AdminModule {}
