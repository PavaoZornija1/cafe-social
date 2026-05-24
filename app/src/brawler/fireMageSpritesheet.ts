import type { HeroSpriteConfig } from './heroSpriteTypes';

/** FireMage.png — 1254×1254, 6×6 grid of 209px cells (same layout as Rift/Bolt). */
export const FIRE_MAGE_SHEET_PX = { width: 1254, height: 1254 } as const;
export const FIRE_MAGE_FRAME_PX = { w: 209, h: 209 } as const;

const GORGON_ARENA_DISPLAY_SCALE = 1.65 * 0.75;
export const FIRE_MAGE_DISPLAY_SCALE =
  (64 * GORGON_ARENA_DISPLAY_SCALE) / FIRE_MAGE_FRAME_PX.w;

export const FIRE_MAGE_HIT_ANCHOR_OFFSET_X = 0;
export const FIRE_MAGE_HIT_FINE_OFFSET_SHEET_PX = { right: 0, left: 0 } as const;

export const FIRE_MAGE_ANIM = {
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

/** Ignis — fire mage arena sprites (`FireMage.png`), `hero_frost`. */
export const IGNIS_ARENA_HERO_ID = 'hero_frost';

/** @deprecated Use `IGNIS_ARENA_HERO_ID`. */
export const FIRE_MAGE_ARENA_HERO_ID = IGNIS_ARENA_HERO_ID;

export const IGNIS_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: IGNIS_ARENA_HERO_ID,
  source: require('../../assets/brawlerHeroes/FireMage.png'),
  sheetPx: FIRE_MAGE_SHEET_PX,
  framePx: FIRE_MAGE_FRAME_PX,
  displayScale: FIRE_MAGE_DISPLAY_SCALE,
  hitAnchorOffsetX: FIRE_MAGE_HIT_ANCHOR_OFFSET_X,
  hitFineOffsetSheetPx: FIRE_MAGE_HIT_FINE_OFFSET_SHEET_PX,
  anim: FIRE_MAGE_ANIM,
};

/** @deprecated Use `IGNIS_HERO_SPRITE_CONFIG`. */
export const FIRE_MAGE_HERO_SPRITE_CONFIG = IGNIS_HERO_SPRITE_CONFIG;
