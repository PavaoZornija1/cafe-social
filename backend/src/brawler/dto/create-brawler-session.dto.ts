import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CreateBrawlerParticipantDto)
  participants!: CreateBrawlerParticipantDto[];
}

