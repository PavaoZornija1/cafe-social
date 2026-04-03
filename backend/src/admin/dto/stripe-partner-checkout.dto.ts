import { IsOptional, IsString } from 'class-validator';

export class StripePartnerCheckoutDto {
  /** Overrides `STRIPE_PARTNER_PRICE_ID` when set. */
  @IsOptional()
  @IsString()
  priceId?: string;
}
