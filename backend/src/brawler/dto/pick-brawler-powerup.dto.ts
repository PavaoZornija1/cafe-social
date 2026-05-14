import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class PickBrawlerPowerupDto {
  /** Relative timestamp since match start (ms). */
  @IsInt()
  @Min(0)
  atMs!: number;

  /** Which participant picked the power-up. */
  @IsUUID()
  actorParticipantId!: string;

  /**
   * Client-generated id for a spawned pickup instance.
   * Server uses this for idempotency (same spawn cannot be picked twice).
   */
  @IsString()
  spawnId!: string;

  /** Stable power-up definition id (must exist in this session's config snapshot). */
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
