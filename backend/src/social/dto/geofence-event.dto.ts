import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GeofenceEventDto {
  @IsUUID()
  venueId!: string;

  @IsIn(['enter', 'exit'])
  kind!: 'enter' | 'exit';

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientDedupeKey?: string;
}
