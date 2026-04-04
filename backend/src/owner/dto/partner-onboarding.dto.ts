import { VenueOrganizationKind } from '@prisma/client';
import {
  Allow,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
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

  /** GeoJSON Polygon (WGS84, lng/lat); pin must lie inside. */
  @Allow()
  @IsObject()
  geofencePolygon!: Record<string, unknown>;

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
