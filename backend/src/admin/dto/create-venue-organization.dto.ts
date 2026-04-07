import { VenueOrganizationKind } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateVenueOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(VenueOrganizationKind)
  @IsOptional()
  locationKind?: VenueOrganizationKind;

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

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(999)
  guestPlayDailyGamesLimit?: number | null;
}
