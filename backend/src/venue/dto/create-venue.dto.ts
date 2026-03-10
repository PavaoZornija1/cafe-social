import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsNumber()
  @Min(10)
  radiusMeters = 50;
}

