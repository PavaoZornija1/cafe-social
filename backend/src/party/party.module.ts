import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { VenueModule } from '../venue/venue.module';
import { SocialModule } from '../social/social.module';
import { InvitesModule } from '../invites/invites.module';
import { PartyService } from './party.service';
import { PartyController } from './party.controller';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    PlayerModule,
    VenueModule,
    SocialModule,
    InvitesModule,
  ],
  controllers: [PartyController],
  providers: [PartyService],
  exports: [PartyService],
})
export class PartyModule {}
