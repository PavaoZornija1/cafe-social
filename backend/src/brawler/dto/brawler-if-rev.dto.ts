import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class BrawlerIfRevDto {
  @IsOptional()
  @IsInt()
  ifSnapshotRev?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
