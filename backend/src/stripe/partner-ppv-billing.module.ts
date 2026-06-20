import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StripePartnerPpvBillingService } from './stripe-partner-ppv-billing.service';

/** PPV usage reporting only — no OwnerModule dependency (safe for SocialModule). */
@Module({
  imports: [PrismaModule],
  providers: [StripePartnerPpvBillingService],
  exports: [StripePartnerPpvBillingService],
})
export class PartnerPpvBillingModule {}
