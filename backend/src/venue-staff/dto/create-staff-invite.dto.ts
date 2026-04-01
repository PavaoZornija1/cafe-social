import { VenueStaffRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateStaffInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(VenueStaffRole)
  role!: VenueStaffRole;
}
