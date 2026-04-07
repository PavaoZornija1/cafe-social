import { Module } from '@nestjs/common';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';
import { PlayerRepository } from './player.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StatsModule } from '../stats/stats.module';
import { PushModule } from '../push/push.module';
import { VenueModule } from '../venue/venue.module';

@Module({
  imports: [PrismaModule, AuthModule, StatsModule, PushModule, VenueModule],
  controllers: [PlayerController],
  providers: [PlayerService, PlayerRepository],
  exports: [PlayerService],
})
export class PlayerModule {}

