import { IsOptional, IsUUID } from 'class-validator';

export class UpdatePresenceDto {
  /** Omit or set null to clear presence. */
  @IsOptional()
  @IsUUID()
  venueId?: string | null;
}
