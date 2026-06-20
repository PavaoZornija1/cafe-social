import { Module, forwardRef } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripePartnerBillingService } from './stripe-partner-billing.service';
import { PartnerPpvBillingModule } from './partner-ppv-billing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerModule } from '../owner/owner.module';

@Module({
  imports: [PrismaModule, PartnerPpvBillingModule, forwardRef(() => OwnerModule)],
  controllers: [StripeWebhookController],
  providers: [StripePartnerBillingService],
  exports: [StripePartnerBillingService, PartnerPpvBillingModule],
})
export class StripeModule {}
