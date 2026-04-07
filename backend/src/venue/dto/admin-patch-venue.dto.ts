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
}
