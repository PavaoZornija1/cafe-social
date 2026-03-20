import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { GameEventType, Prisma } from '@prisma/client';

export class BrawlerEventInputDto {
  @IsInt()
  @Min(0)
  atMs!: number;

  @IsString()
  eventType!: GameEventType;

  @IsOptional()
  @IsUUID()
  actorParticipantId?: string;

  @IsOptional()
  @IsUUID()
  targetParticipantId?: string;

  @IsOptional()
  @IsObject()
  payload?: Prisma.InputJsonValue;
}

export class RecordBrawlerEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BrawlerEventInputDto)
  events!: BrawlerEventInputDto[];
}

