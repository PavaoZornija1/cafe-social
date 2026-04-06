import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PatchVenueNudgeAssignmentDto {
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  titleOverride?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bodyOverride?: string | null;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  @IsOptional()
  afterMinutesOverride?: number | null;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
