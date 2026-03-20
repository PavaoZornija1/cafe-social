import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerModule } from '../player/player.module';
import { FriendshipService } from './friendship.service';
import { DiscoveryService } from './discovery.service';
import { SocialController } from './social.controller';

@Module({
  imports: [AuthModule, PrismaModule, VenueModule, PlayerModule],
  controllers: [SocialController],
  providers: [FriendshipService, DiscoveryService],
  exports: [FriendshipService, DiscoveryService],
})
export class SocialModule {}
