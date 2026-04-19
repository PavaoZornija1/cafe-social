import { WordCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSoloWordSessionDto {
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsString()
  @IsIn(['en', 'de', 'es', 'hr'])
  language!: string;

  @IsInt()
  @Min(3)
  @Max(12)
  wordCount!: number;

  @IsString()
  @IsIn(['easy', 'normal', 'hard'])
  difficulty!: string;

  @IsOptional()
  @IsEnum(WordCategory)
  category?: WordCategory;

  /** When true, player is in global (no-venue) mode — requires active subscription. */
  @IsOptional()
  @IsBoolean()
  globalPlay?: boolean;
}
