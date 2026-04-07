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
import { PerkModule } from './perk/perk.module';
import { ReceiptModule } from './receipt/receipt.module';
import { AdminModule } from './admin/admin.module';
import { OwnerModule } from './owner/owner.module';
import { StaffModule } from './staff/staff.module';
import { RevenueCatModule } from './revenuecat/revenuecat.module';
import { StripeModule } from './stripe/stripe.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'onboarding',
        ttl: 60000,
        limit: 8,
      },
    ]),
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
    PerkModule,
    ReceiptModule,
    AdminModule,
    OwnerModule,
    StaffModule,
    RevenueCatModule,
    StripeModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}


