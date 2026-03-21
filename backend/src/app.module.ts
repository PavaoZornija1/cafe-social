import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { VenueModule } from './venue/venue.module';
import { PlayerModule } from './player/player.module';
import { AuthModule } from './auth/auth.module';
import { ChallengeModule } from './challenge/challenge.module';
import { WordModule } from './word/word.module';
import { SocialModule } from './social/social.module';
import { InvitesModule } from './invites/invites.module';
import { PartyModule } from './party/party.module';
import { BrawlerModule } from './brawler/brawler.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    VenueModule,
    PlayerModule,
    ChallengeModule,
    WordModule,
    SocialModule,
    InvitesModule,
    PartyModule,
    BrawlerModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}


