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

export function matchPhaseLabelDyn(
  elapsed: number,
  chaosEndS: number,
  endgameEndS: number,
): string {
  if (elapsed >= endgameEndS) return 'Sudden Death';
  if (elapsed >= chaosEndS) return 'Endgame';
  return 'Chaos';
}

export function matchPhaseMods(elapsed: number, chaosEndS: number, endgameEndS: number) {
  if (elapsed >= endgameEndS) return { enemySpeed: 1.35, contactDmg: 1.35 };
  if (elapsed >= chaosEndS) return { enemySpeed: 1.15, contactDmg: 1.15 };
  return { enemySpeed: 1.0, contactDmg: 1.0 };
}
