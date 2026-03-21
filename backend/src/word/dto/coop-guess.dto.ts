import { IsString, MinLength } from 'class-validator';

export class CoopGuessDto {
  @IsString()
  @MinLength(1)
  guess!: string;
}
