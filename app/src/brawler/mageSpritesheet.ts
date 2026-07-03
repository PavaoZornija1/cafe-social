import type { HeroSpriteConfig } from './heroSpriteTypes';
import {
  ARENA_BASE_BODY_DISPLAY_SCALE,
  ARENA_FRAME_PX,
} from './heroSpriteConstants';

export const MAGE_FRAME_PX = ARENA_FRAME_PX;

/** Mage art fills less of the cell — scale up for on-screen height. */
export const MAGE_DISPLAY_SCALE = ARENA_BASE_BODY_DISPLAY_SCALE * 1.5;

/** Ignis — strip sprites in assets/brawlerHeroes/mage/. */
export const IGNIS_ARENA_HERO_ID = 'hero_frost';

/** Hand-drawn strip sprites in assets/brawlerHeroes/mage/. */
export const MAGE_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: IGNIS_ARENA_HERO_ID,
  framePx: MAGE_FRAME_PX,
  displayScale: MAGE_DISPLAY_SCALE,
  bodyScale: ARENA_BASE_BODY_DISPLAY_SCALE,
  feetSheetPx: 116,
  attackHitFromTopPx: 28,
  hitAnchorOffsetX: 0,
  hitFineOffsetSheetPx: { right: 0, left: 0 },
  strips: {
    idleRight: {
      source: require('../../assets/brawlerHeroes/mage/idle_right.png'),
      frameCount: 4,
    },
    idleLeft: {
      source: require('../../assets/brawlerHeroes/mage/idle_left.png'),
      frameCount: 4,
    },
    walkRight: {
      source: require('../../assets/brawlerHeroes/mage/walk_right.png'),
      frameCount: 9,
    },
    walkLeft: {
      source: require('../../assets/brawlerHeroes/mage/walk_left.png'),
      frameCount: 9,
    },
    attackRight: {
      source: require('../../assets/brawlerHeroes/mage/attack_right.png'),
      frameCount: 12,
    },
    attackLeft: {
      source: require('../../assets/brawlerHeroes/mage/attack_left.png'),
      frameCount: 12,
    },
    jumpRight: {
      source: require('../../assets/brawlerHeroes/mage/jump_right.png'),
      frameCount: 5,
    },
    jumpLeft: {
      source: require('../../assets/brawlerHeroes/mage/jump_left.png'),
      frameCount: 5,
    },
    dashRight: {
      source: require('../../assets/brawlerHeroes/mage/dash_right.png'),
      frameCount: 5,
    },
    dashLeft: {
      source: require('../../assets/brawlerHeroes/mage/dash_left.png'),
      frameCount: 5,
    },
  },
};

/** @deprecated Use `MAGE_HERO_SPRITE_CONFIG`. */
export const IGNIS_HERO_SPRITE_CONFIG = MAGE_HERO_SPRITE_CONFIG;
