import type { HeroSpriteConfig } from './heroSpriteTypes';
import {
  ARENA_BASE_BODY_DISPLAY_SCALE,
  ARENA_FRAME_PX,
} from './heroSpriteConstants';

export const BLONDEE_FRAME_PX = ARENA_FRAME_PX;

/** Blondee art fills less of the cell — scale up for on-screen height. */
export const BLONDEE_DISPLAY_SCALE = ARENA_BASE_BODY_DISPLAY_SCALE * 1.5;

/** Blondee — strip sprites in assets/brawlerHeroes/blondee/. */
export const BLONDEE_ARENA_HERO_ID = 'hero_blondee';

export const BLONDEE_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: BLONDEE_ARENA_HERO_ID,
  framePx: BLONDEE_FRAME_PX,
  displayScale: BLONDEE_DISPLAY_SCALE,
  bodyScale: ARENA_BASE_BODY_DISPLAY_SCALE,
  feetSheetPx: 116,
  attackHitFromTopPx: 32,
  hitAnchorOffsetX: 0,
  hitFineOffsetSheetPx: { right: 0, left: 0 },
  strips: {
    idleRight: {
      source: require('../../assets/brawlerHeroes/blondee/idle_right.webp'),
      frameCount: 4,
    },
    idleLeft: {
      source: require('../../assets/brawlerHeroes/blondee/idle_left.webp'),
      frameCount: 4,
    },
    walkRight: {
      source: require('../../assets/brawlerHeroes/blondee/walk_right.webp'),
      frameCount: 8,
    },
    walkLeft: {
      source: require('../../assets/brawlerHeroes/blondee/walk_left.webp'),
      frameCount: 8,
    },
    attackRight: {
      source: require('../../assets/brawlerHeroes/blondee/attack_right.webp'),
      frameCount: 12,
    },
    attackLeft: {
      source: require('../../assets/brawlerHeroes/blondee/attack_left.webp'),
      frameCount: 12,
    },
    jumpRight: {
      source: require('../../assets/brawlerHeroes/blondee/jump_right.webp'),
      frameCount: 8,
    },
    jumpLeft: {
      source: require('../../assets/brawlerHeroes/blondee/jump_left.webp'),
      frameCount: 8,
    },
    dashRight: {
      source: require('../../assets/brawlerHeroes/blondee/dash_right.webp'),
      frameCount: 4,
    },
    dashLeft: {
      source: require('../../assets/brawlerHeroes/blondee/dash_left.webp'),
      frameCount: 4,
    },
  },
};
