import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMeOnboardingDto {
  @IsOptional()
  @IsBoolean()
  playerComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  staffComplete?: boolean;
}
