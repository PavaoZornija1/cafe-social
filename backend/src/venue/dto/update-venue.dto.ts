import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';

export class UpdateVenueDto extends PartialType(CreateVenueDto) {
  /** IANA timezone for owner analytics (hour-of-day). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  analyticsTimeZone?: string | null;
}

