import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class BanPlayerDto {
  @IsUUID()
  playerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  reason?: string | null;
}
