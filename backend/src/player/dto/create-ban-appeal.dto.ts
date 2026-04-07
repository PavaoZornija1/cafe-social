import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBanAppealDto {
  @IsUUID()
  venueId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  message!: string;
}
