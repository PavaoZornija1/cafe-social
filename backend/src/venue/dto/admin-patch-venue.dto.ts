import { PartialType } from '@nestjs/mapped-types';
import {
  Allow,
  IsArray,
  IsBoolean,
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
}
