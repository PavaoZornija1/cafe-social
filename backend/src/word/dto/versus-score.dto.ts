import { IsInt, Max, Min } from 'class-validator';

export class VersusScoreDto {
  @IsInt()
  @Min(1)
  @Max(1)
  increment!: number;
}
