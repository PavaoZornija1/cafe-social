import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVenueOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  slug?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  platformBillingPlan?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  platformBillingStatus?: string | null;

  @IsDateString()
  @IsOptional()
  platformBillingRenewsAt?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  stripeCustomerId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  billingPortalUrl?: string | null;
}
