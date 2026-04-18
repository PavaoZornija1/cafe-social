import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveBanAppealDto {
  @IsIn(['dismissed', 'upheld', 'lifted'])
  outcome!: 'dismissed' | 'upheld' | 'lifted';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staffNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  staffMessageToPlayer?: string;

  @IsOptional()
  @IsBoolean()
  notifyPlayer?: boolean;
}
