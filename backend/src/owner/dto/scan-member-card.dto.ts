import { IsString, MinLength } from 'class-validator';

export class ScanMemberCardDto {
  /** Raw QR JSON, deep link, or member token string. */
  @IsString()
  @MinLength(8)
  qrPayload!: string;
}
