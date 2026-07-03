import type { HeroSpriteConfig } from './heroSpriteTypes';
import {
  ARENA_BASE_BODY_DISPLAY_SCALE,
  ARENA_FRAME_PX,
} from './heroSpriteConstants';

export const SCIENTIST_FRAME_PX = ARENA_FRAME_PX;

/** Scientist art fills less of the cell — scale up for on-screen height. */
export const SCIENTIST_DISPLAY_SCALE = ARENA_BASE_BODY_DISPLAY_SCALE * 1.5;

/** Echo — strip sprites in assets/brawlerHeroes/scientist/. */
export const ECHO_ARENA_HERO_ID = 'hero_echo';

/** Hand-drawn strip sprites in assets/brawlerHeroes/scientist/. */
export const SCIENTIST_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: ECHO_ARENA_HERO_ID,
  framePx: SCIENTIST_FRAME_PX,
  displayScale: SCIENTIST_DISPLAY_SCALE,
  bodyScale: ARENA_BASE_BODY_DISPLAY_SCALE,
  feetSheetPx: 116,
  attackHitFromTopPx: 30,
  hitAnchorOffsetX: 0,
  hitFineOffsetSheetPx: { right: 0, left: 0 },
  strips: {
    idleRight: {
      source: require('../../assets/brawlerHeroes/scientist/idle_right.png'),
      frameCount: 5,
    },
    idleLeft: {
      source: require('../../assets/brawlerHeroes/scientist/idle_left.png'),
      frameCount: 5,
    },
    walkRight: {
      source: require('../../assets/brawlerHeroes/scientist/walk_right.png'),
      frameCount: 9,
    },
    walkLeft: {
      source: require('../../assets/brawlerHeroes/scientist/walk_left.png'),
      frameCount: 9,
    },
    attackRight: {
      source: require('../../assets/brawlerHeroes/scientist/attack_right.png'),
      frameCount: 13,
    },
    attackLeft: {
      source: require('../../assets/brawlerHeroes/scientist/attack_left.png'),
      frameCount: 13,
    },
    jumpRight: {
      source: require('../../assets/brawlerHeroes/scientist/jump_right.png'),
      frameCount: 7,
    },
    jumpLeft: {
      source: require('../../assets/brawlerHeroes/scientist/jump_left.png'),
      frameCount: 7,
    },
    dashRight: {
      source: require('../../assets/brawlerHeroes/scientist/dash_right.png'),
      frameCount: 5,
    },
    dashLeft: {
      source: require('../../assets/brawlerHeroes/scientist/dash_left.png'),
      frameCount: 5,
    },
  },
};
