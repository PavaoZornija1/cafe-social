import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerModule } from '../player/player.module';
import { VenueFeedModule } from '../venue-feed/venue-feed.module';
import { PushModule } from '../push/push.module';
import { FriendshipService } from './friendship.service';
import { DiscoveryService } from './discovery.service';
import { GeofenceService } from './geofence.service';
import { SocialController } from './social.controller';

@Module({
  imports: [AuthModule, PrismaModule, VenueModule, PlayerModule, VenueFeedModule, PushModule],
  controllers: [SocialController],
  providers: [FriendshipService, DiscoveryService, GeofenceService],
  exports: [FriendshipService, DiscoveryService, GeofenceService],
})
export class SocialModule {}
