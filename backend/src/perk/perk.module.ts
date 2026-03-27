import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { VenuePerkController } from './venue-perk.controller';
import { VenuePerkService } from './venue-perk.service';
import { VenueModule } from '../venue/venue.module';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule, VenueModule],
  controllers: [VenuePerkController],
  providers: [VenuePerkService],
  exports: [VenuePerkService],
})
export class PerkModule {}
