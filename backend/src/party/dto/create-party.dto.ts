import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePartyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
