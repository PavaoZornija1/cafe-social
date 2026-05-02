import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class EnqueueBrawlerMatchQueueDto {
  @IsUUID()
  venueId!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  /** When true, finishing the match can update competitive + brawler ratings (1v1 only). */
  @IsOptional()
  @IsBoolean()
  ranked?: boolean;

  @IsString()
  @MinLength(1)
  brawlerHeroId!: string;
}

export class LeaveBrawlerMatchQueueDto {
  @IsUUID()
  venueId!: string;
}
