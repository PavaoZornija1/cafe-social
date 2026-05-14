import { IsString, MaxLength, MinLength } from 'class-validator';

export class LockRedemptionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

