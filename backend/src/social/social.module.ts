import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerModule } from '../player/player.module';
import { VenueFeedModule } from '../venue-feed/venue-feed.module';
import { PushModule } from '../push/push.module';
import { PartnerPpvBillingModule } from '../stripe/partner-ppv-billing.module';
import { FriendshipService } from './friendship.service';
import { DiscoveryService } from './discovery.service';
import { GeofenceService } from './geofence.service';
import { ProximityArrivalService } from './proximity-arrival.service';
import { VenuePolygonSessionService } from './venue-polygon-session.service';
import { SocialController } from './social.controller';
import { SocialInboxService } from './social-inbox.service';
import { PlayerInboxService } from './player-inbox.service';

@Module({
  imports: [AuthModule, PrismaModule, VenueModule, PlayerModule, VenueFeedModule, PushModule, PartnerPpvBillingModule],
  controllers: [SocialController],
  providers: [
    PlayerInboxService,
    FriendshipService,
    DiscoveryService,
    GeofenceService,
    ProximityArrivalService,
    VenuePolygonSessionService,
    SocialInboxService,
  ],
  exports: [
    FriendshipService,
    DiscoveryService,
    GeofenceService,
    SocialInboxService,
    PlayerInboxService,
  ],
})
export class SocialModule {}
