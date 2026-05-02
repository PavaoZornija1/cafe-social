import { IsInt, IsOptional } from 'class-validator';

export class BrawlerIfRevDto {
  @IsOptional()
  @IsInt()
  ifSnapshotRev?: number;
}
