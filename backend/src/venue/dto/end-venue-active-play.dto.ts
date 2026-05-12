import { IsUUID } from 'class-validator';

export class EndVenueActivePlayDto {
  @IsUUID()
  sessionId!: string;
}
