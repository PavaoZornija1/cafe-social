import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewReceiptDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  staffNote?: string;

  @IsOptional()
  @IsBoolean()
  abuseFlag?: boolean;
}
