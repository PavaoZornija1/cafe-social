import { VenueOrganizationKind } from '@prisma/client';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PartnerOnboardingDto {
  @IsEnum(VenueOrganizationKind)
  locationKind!: VenueOrganizationKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organizationName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  venueName!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsNumber()
  @Min(10)
  @Max(5000)
  radiusMeters!: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  analyticsTimeZone?: string;
}
