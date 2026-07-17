export type ArenaHudBumpSignals = {
  /** Floor of match clock remaining (seconds). */
  matchClockCeil: number;
  /** Floor of pre-match countdown. */
  preMatchCeil: number;
  heroHp: number;
  kills: number;
  deaths: number;
  spriteKey: string;
  enemyAliveKey: string;
  powerupKey: string;
  buffKey: string;
  dashReady: boolean;
};

export function arenaHudSpriteKey(params: {
  anim: string;
  walk: number;
  idle: number;
  hit: number;
  jump: number;
  dash: number;
  facing: string;
}): string {
  return `${params.anim}:${params.walk}:${params.idle}:${params.hit}:${params.jump}:${params.dash}:${params.facing}`;
}

export function shouldBumpArenaHud(
  prev: ArenaHudBumpSignals | null,
  next: ArenaHudBumpSignals,
): boolean {
  if (!prev) return true;
  return (
    prev.matchClockCeil !== next.matchClockCeil ||
    prev.preMatchCeil !== next.preMatchCeil ||
    prev.heroHp !== next.heroHp ||
    prev.kills !== next.kills ||
    prev.deaths !== next.deaths ||
    prev.spriteKey !== next.spriteKey ||
    prev.enemyAliveKey !== next.enemyAliveKey ||
    prev.powerupKey !== next.powerupKey ||
    prev.buffKey !== next.buffKey ||
    prev.dashReady !== next.dashReady
  );
}
