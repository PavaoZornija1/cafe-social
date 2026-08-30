import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PartyBrawlerParticipantDto {
  @IsUUID()
  playerId!: string;

  @IsString()
  brawlerHeroId!: string;
}

export class CreatePartyBrawlerSessionDto {
  @IsUUID()
  partyId!: string;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsBoolean()
  ranked?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => PartyBrawlerParticipantDto)
  participants!: PartyBrawlerParticipantDto[];
}
