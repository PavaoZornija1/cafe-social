import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdminNudgeTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  nudgeType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titleTemplate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  bodyTemplate!: string;

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
