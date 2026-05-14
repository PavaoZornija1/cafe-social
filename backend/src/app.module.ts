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
import { EmailModule } from './email/email.module';
import { RedisModule } from './redis/redis.module';
import { QueueBotModule } from './queue-bot/queue-bot.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Named throttler buckets keyed by use case. `@Throttle({ <name>: { limit, ttl } })` on a
    // controller method opts that route into the matching bucket. Tracker keys default to the
    // request IP (IPv4/IPv6) — single Clerk-authenticated callers map to one bucket each.
    ThrottlerModule.forRoot([
      // Self-serve partner onboarding bootstrap (legacy bucket; do not narrow without checking).
      { name: 'onboarding', ttl: 60000, limit: 8 },
      // Word/brawler queue enqueue: brief bursts are fine, but no spamming the matchmaker.
      { name: 'enqueue', ttl: 60000, limit: 30 },
      // Presence heartbeat: foreground + ~5 min ticker + manual venue switches → keep generous.
      { name: 'presence', ttl: 60000, limit: 60 },
      // Friend graph mutations (request / accept / reject / cancel) — discourages harassment loops.
      { name: 'friend', ttl: 60000, limit: 20 },
      // Perk + invite redemption — small bursts during a visit; bots/abuse capped well below that.
      { name: 'redeem', ttl: 60000, limit: 20 },
      // Receipt upload: image payload, more expensive — tighter cap.
      { name: 'receipt', ttl: 60000, limit: 10 },
    ]),
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    EmailModule,
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
    QueueBotModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}


