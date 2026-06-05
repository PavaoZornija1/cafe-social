import type { BrawlerArenaHeroStats } from '../../navigation/type';
import {
  BASE_MOVE_SPEED_PX,
  DASH_DURATION_S,
  DASH_SPEED,
  FALLBACK_ARENA_HERO_STATS,
} from './constants';

export function arenaHeroCombat(stats: BrawlerArenaHeroStats | undefined) {
  const s: BrawlerArenaHeroStats = { ...FALLBACK_ARENA_HERO_STATS, ...stats };
  const dashCooldownS = Math.max(0.05, s.dashCooldownMs / 1000);
  const dashDmg = Math.round(s.attackDamage * 0.5);
  const dashKnockbackSpeed = DASH_SPEED * s.attackKnockback;
  const dashShovePx = dashKnockbackSpeed * DASH_DURATION_S;
  return {
    baseHp: s.baseHp,
    moveSpeedPx: BASE_MOVE_SPEED_PX * s.moveSpeed,
    dashCooldownS,
    attackDamage: s.attackDamage,
    dashDmg,
    dashKnockbackSpeed,
    dashShovePx,
  };
}

export function formatMatchClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export type MatchPhaseKey = 'chaos' | 'endgame' | 'sudden_death';

export function matchPhaseKey(
  elapsed: number,
  chaosEndS: number,
  endgameEndS: number,
): MatchPhaseKey {
  if (elapsed >= endgameEndS) return 'sudden_death';
  if (elapsed >= chaosEndS) return 'endgame';
  return 'chaos';
}

export function matchPhaseLabelDyn(
  elapsed: number,
  chaosEndS: number,
  endgameEndS: number,
): string {
  const key = matchPhaseKey(elapsed, chaosEndS, endgameEndS);
  if (key === 'sudden_death') return 'Sudden Death';
  if (key === 'endgame') return 'Endgame';
  return 'Chaos';
}

export function matchPhaseMods(elapsed: number, chaosEndS: number, endgameEndS: number) {
  if (elapsed >= endgameEndS) return { enemySpeed: 1.35, contactDmg: 1.35 };
  if (elapsed >= chaosEndS) return { enemySpeed: 1.15, contactDmg: 1.15 };
  return { enemySpeed: 1.0, contactDmg: 1.0 };
}

/** Fraction of world height the lava can reach at end of sudden death. */
export const LAVA_MAX_HEIGHT_FRAC = 0.5;

/**
 * Top Y of the rising lava surface during sudden death, or `null` before that phase.
 * Lava grows from the bottom toward {@link LAVA_MAX_HEIGHT_FRAC} of map height.
 */
export function computeLavaSurfaceY(
  elapsedS: number,
  endgameEndS: number,
  matchMaxS: number,
  worldH: number,
): number | null {
  if (elapsedS < endgameEndS || worldH <= 0) return null;
  const suddenSpan = Math.max(0.001, matchMaxS - endgameEndS);
  const t = Math.min(1, Math.max(0, (elapsedS - endgameEndS) / suddenSpan));
  const lavaH = t * LAVA_MAX_HEIGHT_FRAC * worldH;
  return worldH - lavaH;
}
