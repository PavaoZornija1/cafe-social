import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { VenuePerkController } from './venue-perk.controller';
import { VenuePerkService } from './venue-perk.service';

@Module({
  imports: [PrismaModule, PlayerModule, AuthModule],
  controllers: [VenuePerkController],
  providers: [VenuePerkService],
  exports: [VenuePerkService],
})
export class PerkModule {}
