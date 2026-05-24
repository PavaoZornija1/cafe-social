import type { HeroSpriteConfig } from './heroSpriteTypes';

/** Tariel (paladin) — FemalePaladinTank.png, 1254×1254, 6×6 grid of 209px cells. */
export const RIFT_SHEET_PX = { width: 1254, height: 1254 } as const;
export const RIFT_FRAME_PX = { w: 209, h: 209 } as const;

/** Match Gorgon on-screen height (64 × arena sprite scale). */
const GORGON_ARENA_DISPLAY_SCALE = 1.65 * 0.75;
export const RIFT_DISPLAY_SCALE =
  (64 * GORGON_ARENA_DISPLAY_SCALE) / RIFT_FRAME_PX.w;

export const RIFT_HIT_ANCHOR_OFFSET_X = 0;
export const RIFT_HIT_FINE_OFFSET_SHEET_PX = { right: 0, left: 0 } as const;

/**
 * Row layout (209px cells):
 * - 0: walk right (5 frames, cols 0–4)
 * - 1: walk left
 * - 2: attack right (6 frames)
 * - 3: attack left
 * - 4: jump R/L, dash R/L (cols 0–3)
 */
export const RIFT_ANIM = {
  idleRight: { row: 0, col: 0 },
  idleLeft: { row: 1, col: 0 },
  walkRight: { row: 0, startCol: 0, frameCount: 5 },
  walkLeft: { row: 1, startCol: 0, frameCount: 5 },
  attackRight: { row: 2, startCol: 0, frameCount: 6 },
  attackLeft: { row: 3, startCol: 0, frameCount: 6 },
  jumpRight: { row: 4, col: 0 },
  jumpLeft: { row: 4, col: 1 },
  dashRight: { row: 4, col: 2 },
  dashLeft: { row: 4, col: 3 },
} as const;

/** Tariel — `hero_rift`. */
export const TARIEL_ARENA_HERO_ID = 'hero_rift';

/** @deprecated Use `TARIEL_ARENA_HERO_ID`. */
export const RIFT_ARENA_HERO_ID = TARIEL_ARENA_HERO_ID;

export const TARIEL_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: TARIEL_ARENA_HERO_ID,
  source: require('../../assets/brawlerHeroes/FemalePaladinTank.png'),
  sheetPx: RIFT_SHEET_PX,
  framePx: RIFT_FRAME_PX,
  displayScale: RIFT_DISPLAY_SCALE,
  hitAnchorOffsetX: RIFT_HIT_ANCHOR_OFFSET_X,
  hitFineOffsetSheetPx: RIFT_HIT_FINE_OFFSET_SHEET_PX,
  anim: RIFT_ANIM,
};

/** @deprecated Use `TARIEL_HERO_SPRITE_CONFIG`. */
export const RIFT_HERO_SPRITE_CONFIG = TARIEL_HERO_SPRITE_CONFIG;
