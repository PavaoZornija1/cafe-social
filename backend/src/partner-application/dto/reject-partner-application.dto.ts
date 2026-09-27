import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectPartnerApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
