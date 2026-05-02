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

export type WordMatchQueueModeDto = 'coop' | 'versus';

export class EnqueueWordMatchQueueDto {
  @IsUUID()
  venueId!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

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
  mode!: WordMatchQueueModeDto;

  @IsOptional()
  @IsEnum(WordCategory)
  category?: WordCategory;

  /** Versus only — ranked queue (rating changes on finish). */
  @IsOptional()
  @IsBoolean()
  ranked?: boolean;
}

export class LeaveWordMatchQueueDto {
  @IsUUID()
  venueId!: string;
}
