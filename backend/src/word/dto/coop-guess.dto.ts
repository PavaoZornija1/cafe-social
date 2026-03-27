import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CoopGuessDto {
  @IsString()
  @MinLength(1)
  guess!: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
