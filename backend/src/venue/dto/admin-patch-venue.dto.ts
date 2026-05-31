import { PartialType } from '@nestjs/mapped-types';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';
import {
  PROXIMITY_ALERT_RADIUS_MAX,
  PROXIMITY_ALERT_RADIUS_MIN,
} from '../../lib/proximity-alert-radius';

export class AdminPatchVenueDto extends PartialType(CreateVenueDto) {
  /** Link venue to an organization; `null` clears. */
  @Allow()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  organizationId?: string | null;

  /** Replaces M:N venue types when provided (codes must exist in `VenueType`, e.g. `COFFEE_SHOP`). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venueTypeCodes?: string[];

  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @ValidateIf((_, v) => v !== null)
  lockReason?: string | null;

  /** Max guest games per UTC day at this venue; null clears override (use org / platform default). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(999)
  guestPlayDailyGamesLimit?: number | null;

  /** Super-admin only: nearby arrival push ring radius (meters). Owners cannot set this. */
  @IsOptional()
  @IsInt()
  @Min(PROXIMITY_ALERT_RADIUS_MIN)
  @Max(PROXIMITY_ALERT_RADIUS_MAX)
  proximityAlertRadiusMeters?: number;

  /** Super-admin only: disable nearby arrival pushes for this venue. */
  @IsOptional()
  @IsBoolean()
  proximityAlertsEnabled?: boolean;
}
