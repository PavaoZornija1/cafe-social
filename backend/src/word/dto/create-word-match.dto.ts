import { WordCategory } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export type WordMatchMode = 'coop' | 'versus';

export class CreateWordMatchDto {
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

  @IsString()
  @IsIn(['coop', 'versus'])
  mode!: WordMatchMode;

  /** When set, all words in the deck share this category. */
  @IsOptional()
  @IsEnum(WordCategory)
  category?: WordCategory;
}
