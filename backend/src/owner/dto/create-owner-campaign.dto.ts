import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateOwnerCampaignDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  segmentDays?: number;
}
