import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripePartnerBillingService } from './stripe-partner-billing.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly log = new Logger(StripeWebhookController.name);

  constructor(private readonly billing: StripePartnerBillingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw) {
      this.log.error('Stripe webhook: raw body missing — enable rawBody in NestFactory');
      throw new BadRequestException('Raw body required');
    }
    const sig = req.headers['stripe-signature'];
    try {
      const event = this.billing.verifyWebhookEvent(raw, sig);
      await this.billing.handleStripeEvent(event);
    } catch (e) {
      this.log.warn(
        `Stripe webhook error: ${e instanceof Error ? e.message : e}`,
      );
      throw e;
    }
    return { received: true };
  }
}
