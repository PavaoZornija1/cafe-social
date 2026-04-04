import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateVenueUnderOrgDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  address?: string;

  /** Venue pin (marker); must lie inside the geofence polygon. */
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  /**
   * GeoJSON Polygon (WGS84). Coordinates are [lng, lat] per GeoJSON.
   * Geofence checks use this instead of a radius circle.
   */
  @IsObject()
  @IsNotEmpty()
  geofencePolygon!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;
}
