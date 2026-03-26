import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';

export class AdminPatchVenueDto extends PartialType(CreateVenueDto) {
  /** 4–10 digits. Omit to leave unchanged. */
  @IsOptional()
  @Matches(/^\d{4,10}$/, { message: 'staffPortalPin must be 4–10 digits' })
  staffPortalPin?: string;

  /** When true, removes the staff PIN (portal disabled until a new PIN is set). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  clearStaffPortalPin?: boolean;
}
