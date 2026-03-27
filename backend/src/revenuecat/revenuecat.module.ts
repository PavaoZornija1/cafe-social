import { Module } from '@nestjs/common';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatSyncService } from './revenuecat-sync.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatSyncService],
})
export class RevenueCatModule {}
