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
  /**
   * Player's current venue (geofenced) — required unless the caller is an active subscriber,
   * in whom case the queue is global and presence is not enforced.
   */
  @IsOptional()
  @IsUUID()
  venueId?: string;

  /** Required when `venueId` is set (presence check). Subscribers may omit. */
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
  /** Optional — when omitted, leaves whichever queue the player is currently in. */
  @IsOptional()
  @IsUUID()
  venueId?: string;
}
