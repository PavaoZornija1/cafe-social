import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBrawlerParticipantDto {
  @IsOptional()
  @IsUUID()
  playerId?: string;

  @IsBoolean()
  isBot!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  botName?: string;

  @IsOptional()
  @IsString()
  brawlerHeroId?: string;
}

export class CreateBrawlerSessionDto {
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  /** Ranked 1v1 at a venue only (no bots); requires location when venue is set. */
  @IsOptional()
  @IsBoolean()
  ranked?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CreateBrawlerParticipantDto)
  participants!: CreateBrawlerParticipantDto[];
}

