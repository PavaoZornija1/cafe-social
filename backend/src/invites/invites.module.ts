import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueModule } from '../venue/venue.module';
import { PlayerModule } from '../player/player.module';
import { SocialModule } from '../social/social.module';
import { InviteService } from './invite.service';
import { InvitesController } from './invites.controller';

@Module({
  imports: [AuthModule, PrismaModule, VenueModule, PlayerModule, SocialModule],
  controllers: [InvitesController],
  providers: [InviteService],
  exports: [InviteService],
})
export class InvitesModule {}
