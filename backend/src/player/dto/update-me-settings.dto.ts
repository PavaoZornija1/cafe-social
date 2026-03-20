import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMeSettingsDto {
  @IsOptional()
  @IsBoolean()
  discoverable?: boolean;

  @IsOptional()
  @IsBoolean()
  totalPrivacy?: boolean;
}
