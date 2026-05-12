import { IsNumber, IsString, IsUUID } from 'class-validator';

export class ClaimVenuePlayBudgetIapDto {
  @IsUUID()
  venueId!: string;

  @IsString()
  productId!: string;

  /** RevenueCat / store transaction id (must appear under subscriber.non_subscriptions[productId]). */
  @IsString()
  storeTransactionId!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
