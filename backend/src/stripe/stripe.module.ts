import { Module, forwardRef } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripePartnerBillingService } from './stripe-partner-billing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerModule } from '../owner/owner.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OwnerModule)],
  controllers: [StripeWebhookController],
  providers: [StripePartnerBillingService],
  exports: [StripePartnerBillingService],
})
export class StripeModule {}
