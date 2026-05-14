import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PickBrawlerPowerupDto {
  /** Relative timestamp since match start (ms). */
  @IsInt()
  @Min(0)
  atMs!: number;

  /** Participant who picked up the power-up. */
  @IsUUID()
  actorParticipantId!: string;

  /** Unique id for this spawned pickup instance (client-generated for now). */
  @IsString()
  spawnId!: string;

  /** Power-up definition id (must exist in this session's config snapshot). */
  @IsString()
  powerupId!: string;

  /** Optional pickup location for audit/telemetry. */
  @IsOptional()
  @IsInt()
  x?: number;

  /** Optional pickup location for audit/telemetry. */
  @IsOptional()
  @IsInt()
  y?: number;
}

import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PickBrawlerPowerupDto {
  /**
   * Client-generated id for a spawned pickup instance.
   * Server uses this for idempotency (same spawn cannot be picked twice).
   */
  @IsString()
  spawnId!: string;

  /** Stable power-up definition id (e.g. "speed_boost"). */
  @IsString()
  powerupId!: string;

  /** Which participant picked the power-up. */
  @IsUUID()
  actorParticipantId!: string;

  /** Optional client clock for auditing; not trusted for enforcement. */
  @IsOptional()
  @IsInt()
  @Min(0)
  atMs?: number;

  /** Optional pickup location (for later server-side validation). */
  @IsOptional()
  @IsInt()
  x?: number;

  @IsOptional()
  @IsInt()
  y?: number;
}

