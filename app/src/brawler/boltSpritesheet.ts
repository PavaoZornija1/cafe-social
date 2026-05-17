import type { HeroSpriteConfig } from './heroSpriteTypes';

/** Vespera (assassin) — FemaleRogueAssasin.png, 1254×1254, 6×6 grid of 209px cells. */
export const BOLT_SHEET_PX = { width: 1254, height: 1254 } as const;
export const BOLT_FRAME_PX = { w: 209, h: 209 } as const;

const GORGON_ARENA_DISPLAY_SCALE = 1.65 * 0.75;
export const BOLT_DISPLAY_SCALE =
  (64 * GORGON_ARENA_DISPLAY_SCALE) / BOLT_FRAME_PX.w;

export const BOLT_HIT_ANCHOR_OFFSET_X = 0;
export const BOLT_HIT_FINE_OFFSET_SHEET_PX = { right: 0, left: 0 } as const;

export const BOLT_ANIM = {
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

/** Vespera — `hero_bolt`. */
export const VESPERA_ARENA_HERO_ID = 'hero_bolt';

/** @deprecated Use `VESPERA_ARENA_HERO_ID`. */
export const BOLT_ARENA_HERO_ID = VESPERA_ARENA_HERO_ID;

export const VESPERA_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: VESPERA_ARENA_HERO_ID,
  source: require('../../assets/brawlerHeroes/FemaleRogueAssasin.png'),
  sheetPx: BOLT_SHEET_PX,
  framePx: BOLT_FRAME_PX,
  displayScale: BOLT_DISPLAY_SCALE,
  hitAnchorOffsetX: BOLT_HIT_ANCHOR_OFFSET_X,
  hitFineOffsetSheetPx: BOLT_HIT_FINE_OFFSET_SHEET_PX,
  anim: BOLT_ANIM,
};

/** @deprecated Use `VESPERA_HERO_SPRITE_CONFIG`. */
export const BOLT_HERO_SPRITE_CONFIG = VESPERA_HERO_SPRITE_CONFIG;
