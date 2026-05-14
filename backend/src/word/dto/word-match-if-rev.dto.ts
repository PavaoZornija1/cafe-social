import { IsInt, IsOptional } from 'class-validator';

/** Optional body field for optimistic concurrency (matches Redis live snapshot `rev`). */
export class WordMatchIfRevDto {
  @IsOptional()
  @IsInt()
  ifSnapshotRev?: number;
}
