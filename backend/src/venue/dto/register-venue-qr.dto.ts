import { IsLatitude, IsLongitude, IsOptional, ValidateIf } from 'class-validator';

export class RegisterVenueQrDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsLongitude()
  longitude?: number;
}
