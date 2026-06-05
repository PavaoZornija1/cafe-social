/**
 * Mirror of `app/src/brawler/arenaPlatforms.ts` layout math so server spawns
 * power-ups on the same walkable slabs as the client.
 */
import { BRAWLER_ARENA_PICKUP_RADIUS_PX } from './brawler-arena.types';

const GROUND_STRIP_H = 40;
const FLOOR_PAD = 4;
const HERO_FEET_EMBED_FLOATING_PLATFORM_PX = 4;
const HERO_FEET_EMBED_GROUND_PLATFORM_PX = 15;
const BOTTOM_PLATFORM_NW = 1.0;
const BOTTOM_PLATFORM_NH_FRAC = 1.0;

const POWERUP_CENTER_ABOVE_PLATFORM_PX = 22;

type PlatformNorm = { nx: number; ny: number; nw: number; nh: number };

type PlatformWorld = {
  x: number;
  y: number;
  w: number;
  h: number;
  feetEmbedPx: number;
};

const ledge = (nx: number, ny: number, nw: number, nh: number): PlatformNorm => ({ nx, ny, nw, nh });
const bridge = (nx: number, ny: number, nw = 0.55, nh = 0.03): PlatformNorm => ({ nx, ny, nw, nh });

const ARENA_FLOATING_PLATFORM_NORMALIZED: PlatformNorm[] = [
  bridge(0.37, 0.52, 0.26, 0.028),
  ledge(0.16, 0.7, 0.42, 0.03),
  ledge(0.62, 0.7, 0.22, 0.03),
  ledge(0.06, 0.3, 0.42, 0.03),
  ledge(0.55, 0.3, 0.42, 0.03),
];

function buildArenaPlatforms(worldW: number, worldH: number): PlatformWorld[] {
  const topMid = ARENA_FLOATING_PLATFORM_NORMALIZED.map((n) => ({
    x: n.nx * worldW,
    y: n.ny * worldH,
    w: n.nw * worldW,
    h: n.nh * worldH,
    feetEmbedPx: HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
  }));

  const wBot = BOTTOM_PLATFORM_NW * worldW;
  const xBot = (worldW - wBot) / 2;
  const surfaceY = worldH - GROUND_STRIP_H - FLOOR_PAD;
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
