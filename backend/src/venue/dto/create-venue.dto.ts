import {
  Allow,
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
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

  /**
   * GeoJSON Polygon (WGS84, [lng, lat]). Pin must lie inside; always required on create.
   */
  @Allow()
  @IsObject()
  @IsNotEmpty()
  geofencePolygon!: Record<string, unknown>;

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

  /** When true, players need a GPS-backed QR check-in before venue-gated features unlock. */
  @IsBoolean()
  @IsOptional()
  requiresExplicitCheckIn?: boolean;

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
}

