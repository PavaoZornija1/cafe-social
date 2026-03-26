import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { VenueReceiptController } from './venue-receipt.controller';
import { VenueReceiptService } from './venue-receipt.service';

@Module({
  imports: [PrismaModule, AuthModule, PlayerModule],
  controllers: [VenueReceiptController],
  providers: [VenueReceiptService],
  exports: [VenueReceiptService],
})
export class ReceiptModule {}
