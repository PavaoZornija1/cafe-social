/**
 * Platform hitboxes in **normalized** coordinates (0–1) of the arena view:
 * - `nx`, `ny`: top-left of the solid surface (layout origin: top-left)
 * - `nw`, `nh`: width / height as fractions of arena width / height
 *
 * **Floating tiers:** indices 0–1 = top (smallest) and middle; the **largest**
 * bottom slab is computed from arena height so its **top** matches the purple
 * ground line (`arenaH - groundStripH - floorPad`), same as `floorY + bodyH`.
 */
export type PlatformNorm = {
  nx: number;
  ny: number;
  nw: number;
  nh: number;
};

const ledge = (nx: number, ny: number, nw: number, nh: number) => ({ nx, ny, nw, nh });
const bridge = (nx: number, ny: number, nw = 0.55, nh = 0.03) => ({ nx, ny, nw, nh });
const stairs = (opts: {
  startX: number;
  startY: number;
  steps: number;
  dx?: number;
  dy?: number;
  stepW?: number;
  stepH?: number;
}) => {
  const { startX, startY, steps, dx = 0.11, dy = -0.07, stepW = 0.12, stepH = 0.03 } = opts;
  return Array.from({ length: steps }, (_, i) => ({
    nx: startX + i * dx,
    ny: startY + i * dy,
    nw: stepW,
    nh: stepH,
  }));
};

/** Upper two platforms only (normalized). Bottom tier is from `buildArenaPlatforms`. */
/* export const ARENA_FLOATING_PLATFORM_NORMALIZED: PlatformNorm[] = [
  { nx: 0.38, ny: 0.52, nw: 0.24, nh: 0.028 },
  { nx: 0.19, ny: 0.71, nw: 0.60, nh: 0.03 },
  { nx: 0.49, ny: 0.41, nw: 0.30, nh: 0.03 },
  { nx: 0.19, ny: 0.41, nw: 0.10, nh: 0.03 },
  { nx: 0.19, ny: 0.51, nw: 0.10, nh: 0.03 },
]; */

export const ARENA_FLOATING_PLATFORM_NORMALIZED: PlatformNorm[] = [
  // Top center platform
  bridge(0.001, 0.52, 0.26, 0.028),
  // Side platforms (same height)
  ledge(0.001, 0.70, 0.42, 0.03),
  ledge(0.001, 0.70, 0.22, 0.03),

  //Top left platform
  ledge(0.001, 0.30, 0.42, 0.03),

  //Top right platform
  ledge(0.001, 0.30, 0.42, 0.03),
];

/** Largest platform: width as fraction of arena width (centered). */
const BOTTOM_PLATFORM_NW = 1.0;
/** Minimum slab thickness (px); also scales slightly with arena height. */
const BOTTOM_PLATFORM_NH_FRAC = 1.0;

export type PlatformLedgeSize = 's' | 'm';

export type PlatformWorld = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Feet sit this many px below `y` when standing on this slab (thin floaters need less than thick ground). */
  feetEmbedPx: number;
  /** Floating art size; omit on ground. */
  ledgeSize?: PlatformLedgeSize;
};

/**
 * Upper (thin) moss strips — small embed so feet stay on the visible top, not
 * hanging below the art.
 */
export const HERO_FEET_EMBED_FLOATING_PLATFORM_PX = 4;

/**
 * Bottom / floor slab (thick moss) — match sprite soles to the deck (often larger).
 */
export const HERO_FEET_EMBED_GROUND_PLATFORM_PX = 15;

const LEDGE_NATIVE_W: Record<PlatformLedgeSize, number> = {
  s: 160,
  m: 224,
};

/**
 * Per floating index: which fixed ledge art to use (matches original short/wide intent).
 * 0 top center → m, 1 mid left → m, 2 mid right → s, 3 top left → m, 4 top right → m
 */
const FLOATING_LEDGE_SIZES: PlatformLedgeSize[] = ['m', 'm', 's', 'm', 'm'];

/**
 * Full platform list: floating ledges locked to art width + full-width ground slab.
 * Ground art is `ground.webp` (1920×64), centered on the floor hitbox.
 */
export function buildArenaPlatforms(
  worldW: number,
  worldH: number,
  groundStripH: number,
  floorPad: number = 4,
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
      ledgeSize,
    };
  });

  const wBot = BOTTOM_PLATFORM_NW * worldW;
  const xBot = (worldW - wBot) / 2;
  /** Same as feet on the default floor (`floorY + bodyH`). */
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

/** Spawn standing centered on the bottom (largest) platform. */
export function spawnOnBottomPlatform(
  arenaW: number,
  arenaH: number,
  bodyW: number,
  bodyH: number,
  marginX: number,
  groundStripH: number,
  floorPad: number = 4,
): { x: number; y: number } {
  const plats = buildArenaPlatforms(arenaW, arenaH, groundStripH, floorPad);
  const bot = plats[plats.length - 1]!;
  const x = bot.x + bot.w / 2 - bodyW / 2;
  const clampedX = Math.max(
    marginX,
    Math.min(arenaW - marginX - bodyW, x),
  );
  return {
    x: clampedX,
    y: bot.y - bodyH + bot.feetEmbedPx,
  };
}
