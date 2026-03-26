import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMeSettingsDto {
  @IsOptional()
  @IsBoolean()
  discoverable?: boolean;

  @IsOptional()
  @IsBoolean()
  totalPrivacy?: boolean;

  /** Partner/venue marketing pushes (e.g. order nudge). Independent of `totalPrivacy`. */
  @IsOptional()
  @IsBoolean()
  partnerMarketingPush?: boolean;

  /** Word-match join/start notifications. */
  @IsOptional()
  @IsBoolean()
  matchActivityPush?: boolean;
}
