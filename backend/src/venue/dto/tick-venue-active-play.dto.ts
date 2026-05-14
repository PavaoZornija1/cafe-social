import { IsNumber, IsUUID } from 'class-validator';

export class TickVenueActivePlayDto {
  @IsUUID()
  sessionId!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
