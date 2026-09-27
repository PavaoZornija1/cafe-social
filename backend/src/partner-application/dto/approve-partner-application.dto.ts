import { VenueOrganizationKind } from '@prisma/client';
import {
  Allow,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ApprovePartnerApplicationDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @Allow()
  @IsObject()
  geofencePolygon!: Record<string, unknown>;

  @IsOptional()
  @IsEnum(VenueOrganizationKind)
  locationKind?: VenueOrganizationKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  analyticsTimeZone?: string;
}
