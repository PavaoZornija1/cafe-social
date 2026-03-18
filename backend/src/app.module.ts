import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { VenueModule } from './venue/venue.module';
import { PlayerModule } from './player/player.module';
import { AuthModule } from './auth/auth.module';
import { ChallengeModule } from './challenge/challenge.module';
import { WordModule } from './word/word.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    VenueModule,
    PlayerModule,
    ChallengeModule,
    WordModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}


