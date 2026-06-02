import {
  buildArenaPlatforms,
  type PlatformWorld,
} from '../arenaPlatforms';
import { aabbOverlap } from './collision';
import {
  DUMMY_H,
  DUMMY_HP_MAX,
  DUMMY_W,
  ENEMY_H,
  ENEMY_HP_MAX,
  ENEMY_SPEED,
  ENEMY_W,
  GROUND_STRIP_H,
  MARGIN_SCREEN,
} from './constants';
import type { Dummy, Enemy } from './types';

export function spawnDummiesRandomOnPlatforms(
  count: number,
  heroSpawn: { x: number; y: number },
  worldW: number,
  worldH: number,
  bodyW: number,
  bodyH: number,
  nextDummyIdRef: { current: number },
  dummiesRef: { current: Dummy[] },
) {
  const plats = buildArenaPlatforms(worldW, worldH, GROUND_STRIP_H, 4);
  const validPlats = plats.filter((p) => p.w >= DUMMY_W + 2);
  const next: Dummy[] = [];

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

  const overlapsExisting = (x: number, y: number) =>
    next.some((d) => aabbOverlap(x, y, DUMMY_W, DUMMY_H, d.x, d.y, d.w, d.h));

  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const p = validPlats[Math.floor(Math.random() * validPlats.length)];
      if (!p) break;
      const xMin = clamp(p.x, MARGIN_SCREEN, worldW - MARGIN_SCREEN - DUMMY_W);
      const xMax = clamp(p.x + p.w - DUMMY_W, MARGIN_SCREEN, worldW - MARGIN_SCREEN - DUMMY_W);
      if (xMax <= xMin) continue;
      const x = rand(xMin, xMax);
      const y = clamp(p.y - DUMMY_H, 0, worldH - DUMMY_H);
      if (overlapsExisting(x, y)) continue;

      next.push({
        id: nextDummyIdRef.current++,
        x,
        y,
        w: DUMMY_W,
        h: DUMMY_H,
        vy: 0,
        prevY: y,
        onGround: true,
        hp: DUMMY_HP_MAX,
        respawnLeft: 0,
        flashLeft: 0,
        knockVx: 0,
      });
      placed = true;
      break;
    }

    if (!placed) {
      const x = clamp(
        heroSpawn.x + bodyW + 24 + i * (DUMMY_W + 18),
        MARGIN_SCREEN,
        worldW - MARGIN_SCREEN - DUMMY_W,
      );
      const y = clamp(heroSpawn.y + bodyH - DUMMY_H, 0, worldH - DUMMY_H);
      next.push({
        id: nextDummyIdRef.current++,
        x,
        y,
        w: DUMMY_W,
        h: DUMMY_H,
        vy: 0,
        prevY: y,
        onGround: true,
        hp: DUMMY_HP_MAX,
        respawnLeft: 0,
        flashLeft: 0,
        knockVx: 0,
      });
    }
  }

  dummiesRef.current = next;
}

export function spawnEnemyOnRandomPlatform(
  worldW: number,
  worldH: number,
  enemySpeedMul: number,
): Enemy {
  const plats = buildArenaPlatforms(worldW, worldH, GROUND_STRIP_H, 4);
  const valid: { p: PlatformWorld; idx: number }[] = [];
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i]!;
    if (p.w >= ENEMY_W + 2) valid.push({ p, idx: i });
  }
  const pick = valid.length
    ? valid[Math.floor(Math.random() * valid.length)]!
    : { p: plats[plats.length - 1]!, idx: Math.max(0, plats.length - 1) };

  const xMin = Math.max(MARGIN_SCREEN, pick.p.x);
  const xMax = Math.min(worldW - MARGIN_SCREEN - ENEMY_W, pick.p.x + pick.p.w - ENEMY_W);
  const x = xMax > xMin ? xMin + Math.random() * (xMax - xMin) : xMin;
  const y = Math.max(0, Math.min(worldH - ENEMY_H, pick.p.y - ENEMY_H));
  const dir = Math.random() < 0.5 ? -1 : 1;

  return {
    x,
    y,
    w: ENEMY_W,
    h: ENEMY_H,
    vx: dir * ENEMY_SPEED * enemySpeedMul,
    vy: 0,
    prevY: y,
    onGround: true,
    hp: ENEMY_HP_MAX,
    iFramesLeft: 0,
    respawnLeft: 0,
    flashLeft: 0,
    knockVx: 0,
    platformIndex: pick.idx,
  };
}

export function syncEnemyCount(
  count: number,
  worldW: number,
  worldH: number,
  enemySpeedMul: number,
  enemiesRef: { current: Enemy[] },
) {
  const n = Math.max(0, Math.min(6, Math.floor(count)));
  const next: Enemy[] = [];
  for (let i = 0; i < n; i++) {
    next.push(spawnEnemyOnRandomPlatform(worldW, worldH, enemySpeedMul));
  }
  enemiesRef.current = next;
}
