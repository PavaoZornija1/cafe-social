import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PatchAdminNudgeTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(64)
  nudgeType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  titleTemplate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  bodyTemplate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  @IsOptional()
  defaultAfterMinutes?: number | null;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  @IsOptional()
  sortPriority?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
