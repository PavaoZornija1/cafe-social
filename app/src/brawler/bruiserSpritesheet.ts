import type { HeroSpriteConfig } from './heroSpriteTypes';

/** Gorgon (bruiser golem) — BruiserGolem.png, 1024×1024, 8×8 grid of 128px cells. */
export const GORGON_SHEET_PX = { width: 1024, height: 1024 } as const;
export const GORGON_FRAME_PX = { w: 128, h: 128 } as const;

const GORGON_ARENA_DISPLAY_SCALE = 1.65 * 0.75;
export const GORGON_DISPLAY_SCALE =
  (64 * GORGON_ARENA_DISPLAY_SCALE) / GORGON_FRAME_PX.w;

export const GORGON_HIT_ANCHOR_OFFSET_X = 0;
export const GORGON_HIT_FINE_OFFSET_SHEET_PX = { right: 0, left: 0 } as const;

/**
 * Row layout (128px cells):
 * - 0: walk right (7 frames, cols 0–6)
 * - 1: walk left
 * - 2: punch attack right (8 frames)
 * - 3: punch attack left
 * - 4: jump R/L, dash R/L (cols 0–3); cols 4+ optional heavy slam frames
 */
export const GORGON_ANIM = {
  idleRight: { row: 0, col: 0 },
  idleLeft: { row: 1, col: 0 },
  walkRight: { row: 0, startCol: 0, frameCount: 7 },
  walkLeft: { row: 1, startCol: 0, frameCount: 7 },
  attackRight: { row: 2, startCol: 0, frameCount: 8 },
  attackLeft: { row: 3, startCol: 0, frameCount: 8 },
  jumpRight: { row: 4, col: 0 },
  jumpLeft: { row: 4, col: 1 },
  dashRight: { row: 4, col: 2 },
  dashLeft: { row: 4, col: 3 },
} as const;

/** Gorgon — `hero_blaze`, `assets/brawlerHeroes/BruiserGolem.png`. */
export const GORGON_ARENA_HERO_ID = 'hero_blaze';

/** @deprecated Use `GORGON_ARENA_HERO_ID`. */
export const BRUISER_ARENA_HERO_ID = GORGON_ARENA_HERO_ID;

/** @deprecated Use `GORGON_SHEET_PX`. */
export const BRUISER_SHEET_PX = GORGON_SHEET_PX;
/** @deprecated Use `GORGON_FRAME_PX`. */
export const BRUISER_FRAME_PX = GORGON_FRAME_PX;
/** @deprecated Use `GORGON_ANIM`. */
export const BRUISER_ANIM = GORGON_ANIM;

export const GORGON_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: GORGON_ARENA_HERO_ID,
  source: require('../../assets/brawlerHeroes/BruiserGolem.png'),
  sheetPx: GORGON_SHEET_PX,
  framePx: GORGON_FRAME_PX,
  displayScale: GORGON_DISPLAY_SCALE,
  hitAnchorOffsetX: GORGON_HIT_ANCHOR_OFFSET_X,
  hitFineOffsetSheetPx: GORGON_HIT_FINE_OFFSET_SHEET_PX,
  anim: GORGON_ANIM,
};

/** @deprecated Use `GORGON_HERO_SPRITE_CONFIG`. */
export const BLAZE_HERO_SPRITE_CONFIG = GORGON_HERO_SPRITE_CONFIG;
