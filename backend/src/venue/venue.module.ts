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
import { VenueOfferService } from './venue-offer.service';
import { VenueOfferController } from './venue-offer.controller';
import { VenueOrderNudgeCopyService } from './venue-order-nudge-copy.service';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule],
  controllers: [VenueController, VenueAccessController, VenueOfferController],
  providers: [
    VenueService,
    VenueOfferService,
    VenueOrderNudgeCopyService,
    VenueRepository,
    VenueAccessService,
    PlayerVenueRepository,
    SubscriptionRepository,
  ],
  exports: [
    VenueService,
    VenueOfferService,
    VenueOrderNudgeCopyService,
    SubscriptionRepository,
    PlayerVenueRepository,
  ],
})
export class VenueModule {}

