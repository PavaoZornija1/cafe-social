import { IsInt, Min } from 'class-validator';

export class TickBrawlerArenaDto {
  /** Relative timestamp since match start (ms). */
  @IsInt()
  @Min(0)
  atMs!: number;

  @IsInt()
  @Min(100)
  worldW!: number;

  @IsInt()
  @Min(100)
  worldH!: number;
}
