import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class EnqueueBrawlerMatchQueueDto {
  /**
   * Player's current venue (geofenced) — required unless the caller is an active subscriber,
   * in which case the queue is global and presence is not enforced.
   */
  @IsOptional()
  @IsUUID()
  venueId?: string;

  /** When set, caller must be a member; queue pairs only within the same party. */
  @IsOptional()
  @IsUUID()
  partyId?: string;

  /** Required when `venueId` is set (presence check). Subscribers may omit. */
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  /** When true, finishing the match can update competitive + brawler ratings (1v1 only). */
  @IsOptional()
  @IsBoolean()
  ranked?: boolean;

  @IsString()
  @MinLength(1)
  brawlerHeroId!: string;
}

export class LeaveBrawlerMatchQueueDto {
  /** Optional — when omitted, leaves whichever queue the player is currently in. */
  @IsOptional()
  @IsUUID()
  venueId?: string;
}
