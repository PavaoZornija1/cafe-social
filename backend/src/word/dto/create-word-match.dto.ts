import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export type WordMatchMode = 'coop' | 'versus';

export class CreateWordMatchDto {
  @IsOptional()
  @IsUUID()
  venueId?: string;

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
}
