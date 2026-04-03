import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripePartnerBillingService } from './stripe-partner-billing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerModule } from '../owner/owner.module';

@Module({
  imports: [PrismaModule, OwnerModule],
  controllers: [StripeWebhookController],
  providers: [StripePartnerBillingService],
  exports: [StripePartnerBillingService],
})
export class StripeModule {}
