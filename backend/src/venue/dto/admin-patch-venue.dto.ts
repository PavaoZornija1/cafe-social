import { PartialType } from '@nestjs/mapped-types';
import {
  Allow,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';

export class AdminPatchVenueDto extends PartialType(CreateVenueDto) {
  /** Link venue to an organization; `null` clears. */
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  organizationId?: string | null;

  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @ValidateIf((_, v) => v !== null)
  lockReason?: string | null;

  /** GeoJSON Polygon (WGS84, lng/lat). Pin must lie inside; optional on PATCH. */
  @Allow()
  @IsOptional()
  @IsObject()
  geofencePolygon?: Record<string, unknown>;
}
