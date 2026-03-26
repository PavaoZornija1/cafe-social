import {
  IsBoolean,
  IsDateString,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsNumber()
  @Min(10)
  radiusMeters = 50;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsBoolean()
  @IsOptional()
  isPremium?: boolean;

  @IsString()
  @IsOptional()
  menuUrl?: string;

  @IsString()
  @IsOptional()
  orderingUrl?: string;

  @IsString()
  @IsOptional()
  orderNudgeTitle?: string;

  @IsString()
  @IsOptional()
  orderNudgeBody?: string;

  @IsString()
  @IsOptional()
  featuredOfferTitle?: string;

  @IsString()
  @IsOptional()
  featuredOfferBody?: string;

  @IsDateString()
  @IsOptional()
  featuredOfferEndsAt?: string;
}

