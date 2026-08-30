/**
 * Mirror of `app/src/brawler/arenaPlatforms.ts` layout math so server combat
 * and power-up spawns use the same walkable slabs as the client.
 */
import { BRAWLER_ARENA_PICKUP_RADIUS_PX } from './brawler-arena.types';
import {
  FIGHTER_BODY_H,
  FIGHTER_BODY_W,
  FLOOR_PAD,
  GROUND_STRIP_H,
  MARGIN_SCREEN,
} from './brawler-combat.constants';

const HERO_FEET_EMBED_FLOATING_PLATFORM_PX = 4;
const HERO_FEET_EMBED_GROUND_PLATFORM_PX = 15;
const BOTTOM_PLATFORM_NW = 1.0;
const BOTTOM_PLATFORM_NH_FRAC = 1.0;
const POWERUP_CENTER_ABOVE_PLATFORM_PX = 22;

type PlatformNorm = { nx: number; ny: number; nw: number; nh: number };

export type PlatformWorld = {
  x: number;
  y: number;
  w: number;
  h: number;
  feetEmbedPx: number;
};

type PlatformLedgeSize = 's' | 'm';

const ledge = (nx: number, ny: number, nw: number, nh: number): PlatformNorm => ({
  nx,
  ny,
  nw,
  nh,
});
const bridge = (nx: number, ny: number, nw = 0.55, nh = 0.03): PlatformNorm => ({
  nx,
  ny,
  nw,
  nh,
});

/** Must match `ARENA_FLOATING_PLATFORM_NORMALIZED` in app arenaPlatforms.ts */
const ARENA_FLOATING_PLATFORM_NORMALIZED: PlatformNorm[] = [
  bridge(0.37, 0.62, 0.26, 0.028),
  bridge(0.65, 0.52, 0.26, 0.028),
  bridge(0.1, 0.52, 0.26, 0.028),
  bridge(0.3, 0.22, 0.4, 0.028),
  ledge(0.11, 0.68, 0.42, 0.03),
  ledge(-0.1, 0.4, 0.42, 0.03),
  ledge(0.57, 0.68, 0.22, 0.03),
  ledge(0.04, 0.28, 0.42, 0.03),
  ledge(0.59, 0.28, 0.42, 0.03),
  ledge(0.01, 0.75, 0.22, 0.03),
  ledge(0.75, 0.75, 0.22, 0.03),
  ledge(0.29, 0.4, 0.22, 0.03),
  ledge(0.49, 0.4, 0.22, 0.03),
];

const LEDGE_NATIVE_W: Record<PlatformLedgeSize, number> = {
  s: 160,
  m: 224,
};

const FLOATING_LEDGE_SIZES: PlatformLedgeSize[] = [
  'm',
  'm',
  'm',
  'm',
  'm',
  'm',
  's',
  'm',
  'm',
  's',
  's',
  's',
  's',
];

export function buildArenaPlatforms(
  worldW: number,
  worldH: number,
  groundStripH: number = GROUND_STRIP_H,
  floorPad: number = FLOOR_PAD,
): PlatformWorld[] {
  const topMid = ARENA_FLOATING_PLATFORM_NORMALIZED.map((n, i) => {
    const ledgeSize = FLOATING_LEDGE_SIZES[i] ?? 'm';
    const artW = LEDGE_NATIVE_W[ledgeSize];
    const y = n.ny * worldH;
    const h = n.nh * worldH;
    const cx = n.nx * worldW + (n.nw * worldW) / 2;
    return {
      x: cx - artW / 2,
      y,
      w: artW,
      h,
      feetEmbedPx: HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
    };
  });

  const wBot = BOTTOM_PLATFORM_NW * worldW;
  const xBot = (worldW - wBot) / 2;
  const surfaceY = worldH - groundStripH - floorPad;
  const hBot = Math.max(14, BOTTOM_PLATFORM_NH_FRAC * worldH);
  const bottom: PlatformWorld = {
    x: xBot,
    y: surfaceY,
    w: wBot,
    h: hBot,
    feetEmbedPx: HERO_FEET_EMBED_GROUND_PLATFORM_PX,
  };

  return [...topMid, bottom];
}

/** Spread fighters on the bottom platform (same logic as client spawnOnBottomPlatform). */
export function spawnFightersOnBottomPlatform(
  count: number,
  worldW: number,
  worldH: number,
  bodyW: number = FIGHTER_BODY_W,
  bodyH: number = FIGHTER_BODY_H,
): Array<{ x: number; y: number }> {
  const plats = buildArenaPlatforms(worldW, worldH);
  const bot = plats[plats.length - 1]!;
  const n = Math.max(1, Math.min(4, count));
  const slots: Array<{ x: number; y: number }> = [];
  const usableW = bot.w - bodyW - MARGIN_SCREEN * 2;
  const step = n > 1 ? usableW / (n - 1) : 0;
  const baseY = bot.y - bodyH + bot.feetEmbedPx;

  for (let i = 0; i < n; i++) {
    const xCenter = bot.x + bot.w / 2 - bodyW / 2;
    const offset = n > 1 ? -usableW / 2 + step * i : 0;
    const x = Math.max(
      MARGIN_SCREEN,
      Math.min(worldW - MARGIN_SCREEN - bodyW, xCenter + offset),
    );
    slots.push({ x, y: baseY });
  }
  return slots;
}

export function pickRandomPowerupSpawnPosition(
  worldW: number,
  worldH: number,
): { x: number; y: number } | null {
  const plats = buildArenaPlatforms(worldW, worldH);
  const minPlatformW = BRAWLER_ARENA_PICKUP_RADIUS_PX * 2 + 8;
  const valid = plats.filter((p) => p.w >= minPlatformW);
  if (!valid.length) return null;

  const edgePad = BRAWLER_ARENA_PICKUP_RADIUS_PX + 4;
  for (let attempt = 0; attempt < 16; attempt++) {
    const platform = valid[Math.floor(Math.random() * valid.length)]!;
    const xMin = platform.x + edgePad;
    const xMax = platform.x + platform.w - edgePad;
    if (xMax <= xMin) continue;
    const x = Math.round(xMin + Math.random() * (xMax - xMin));
    const y = Math.round(platform.y - POWERUP_CENTER_ABOVE_PLATFORM_PX);
    if (y < 0 || y > worldH) continue;
    return { x, y };
  }
  return null;
}

/** Expected platform count for layout parity tests (13 floaters + 1 ground). */
export const EXPECTED_ARENA_PLATFORM_COUNT = 14;
