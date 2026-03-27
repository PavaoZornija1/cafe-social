import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class JoinWordMatchDto {
  @IsString()
  @Length(4, 8)
  inviteCode!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
