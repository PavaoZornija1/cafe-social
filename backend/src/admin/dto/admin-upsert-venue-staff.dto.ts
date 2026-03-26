import { VenueStaffRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';

export class AdminUpsertVenueStaffDto {
  @IsEmail()
  email!: string;

  @IsEnum(VenueStaffRole)
  role!: VenueStaffRole;
}
