import { IsString, MaxLength, MinLength } from 'class-validator';

export class ScanRedemptionDto {
  @IsString()
  @MinLength(4)
  @MaxLength(256)
  code!: string;
}

