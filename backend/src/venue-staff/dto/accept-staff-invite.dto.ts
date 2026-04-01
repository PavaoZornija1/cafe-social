import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AcceptStaffInviteDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  token!: string;
}
