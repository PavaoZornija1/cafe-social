import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class MatchPassDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsInt()
  ifSnapshotRev?: number;
}
