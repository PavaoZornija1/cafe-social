import { Module } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { VenueRepository } from './venue.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueAccessController } from './venue-access.controller';
import { VenueAccessService } from './venue-access.service';
import { PlayerVenueRepository } from './player-venue.repository';
import { SubscriptionRepository } from './subscription.repository';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule],
  controllers: [VenueController, VenueAccessController],
  providers: [
    VenueService,
    VenueRepository,
    VenueAccessService,
    PlayerVenueRepository,
    SubscriptionRepository,
  ],
  exports: [VenueService, SubscriptionRepository, PlayerVenueRepository],
})
export class VenueModule {}

