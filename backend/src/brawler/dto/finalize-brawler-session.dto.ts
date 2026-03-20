import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { GameParticipantResult } from '@prisma/client';

export class FinalizeBrawlerParticipantDto {
  @IsUUID()
  participantId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  placement?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsEnum(['WIN', 'LOSS', 'DRAW', 'DNF'] as const)
  result?: GameParticipantResult;
}

export class FinalizeBrawlerSessionDto {
  @IsOptional()
  @IsUUID()
  winnerParticipantId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinalizeBrawlerParticipantDto)
  participants!: FinalizeBrawlerParticipantDto[];
}

