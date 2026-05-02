import { IsNumber, IsOptional } from 'class-validator';

/** Optional coords for venue-scoped solo pass (same rules as guess). */
export class WordSessionPassDto {
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
