import type { HeroSpriteConfig } from './heroSpriteTypes';
import {
  ARENA_BASE_BODY_DISPLAY_SCALE,
  ARENA_FRAME_PX,
} from './heroSpriteConstants';

export const SKATER_FRAME_PX = ARENA_FRAME_PX;

/** Skater art fills less of the cell — scale up for on-screen height. */
export const SKATER_DISPLAY_SCALE = ARENA_BASE_BODY_DISPLAY_SCALE * 1.5;

/** Skater — strip sprites in assets/brawlerHeroes/skater/. */
export const SKATER_ARENA_HERO_ID = 'hero_skater';

export const SKATER_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: SKATER_ARENA_HERO_ID,
  framePx: SKATER_FRAME_PX,
  displayScale: SKATER_DISPLAY_SCALE,
  bodyScale: ARENA_BASE_BODY_DISPLAY_SCALE,
  feetSheetPx: 116,
  attackHitFromTopPx: 32,
  hitAnchorOffsetX: 0,
  hitFineOffsetSheetPx: { right: 0, left: 0 },
  strips: {
    idleRight: {
      source: require('../../assets/brawlerHeroes/skater/idle_right.webp'),
      frameCount: 5,
    },
    idleLeft: {
      source: require('../../assets/brawlerHeroes/skater/idle_left.webp'),
      frameCount: 5,
    },
    walkRight: {
      source: require('../../assets/brawlerHeroes/skater/walk_right.webp'),
      frameCount: 8,
    },
    walkLeft: {
      source: require('../../assets/brawlerHeroes/skater/walk_left.webp'),
      frameCount: 8,
    },
    attackRight: {
      source: require('../../assets/brawlerHeroes/skater/attack_right.webp'),
      frameCount: 12,
    },
    attackLeft: {
      source: require('../../assets/brawlerHeroes/skater/attack_left.webp'),
      frameCount: 12,
    },
    jumpRight: {
      source: require('../../assets/brawlerHeroes/skater/jump_right.webp'),
      frameCount: 8,
    },
    jumpLeft: {
      source: require('../../assets/brawlerHeroes/skater/jump_left.webp'),
      frameCount: 8,
    },
    dashRight: {
      source: require('../../assets/brawlerHeroes/skater/dash_right.webp'),
      frameCount: 5,
    },
    dashLeft: {
      source: require('../../assets/brawlerHeroes/skater/dash_left.webp'),
      frameCount: 5,
    },
  },
};
