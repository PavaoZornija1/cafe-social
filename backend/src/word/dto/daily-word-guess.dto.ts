import { IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export type DailyWordScope = 'global' | 'venue';

export class DailyWordGuessDto {
  @IsIn(['global', 'venue'])
  scope!: DailyWordScope;

  @IsOptional()
  @IsString()
  venueId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  language?: string;

  @IsString()
  @MinLength(1)
  guess!: string;
}
