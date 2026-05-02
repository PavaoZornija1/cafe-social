import { IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CoopGuessDto {
  @IsString()
  @MinLength(1)
  guess!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  /** When set, must match live Redis snapshot `rev` or the server responds 409. */
  @IsOptional()
  @IsInt()
  ifSnapshotRev?: number;
}
