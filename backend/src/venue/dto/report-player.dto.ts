import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReportPlayerDto {
  @IsUUID()
  reportedPlayerId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(256)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
