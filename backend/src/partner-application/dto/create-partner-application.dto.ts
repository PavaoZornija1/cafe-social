import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePartnerApplicationDto {
  @IsEmail()
  @MaxLength(320)
  applicantEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  applicantName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  applicantPhone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  venueName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  country!: string;
}
