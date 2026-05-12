import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class BeginVenueActivePlayDto {
  @IsUUID()
  venueId!: string;

  @IsString()
  @IsIn(['solo_word', 'word_match', 'brawler'])
  kind!: 'solo_word' | 'word_match' | 'brawler';

  @IsOptional()
  @IsUUID()
  gameSessionId?: string;

  @IsOptional()
  @IsUUID()
  soloWordSessionId?: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
