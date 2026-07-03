import type { HeroSpriteConfig } from './heroSpriteTypes';
import {
  ARENA_BASE_BODY_DISPLAY_SCALE,
  ARENA_FRAME_PX,
} from './heroSpriteConstants';

export const TESTER_GOLEM_FRAME_PX = ARENA_FRAME_PX;

/** Hand-drawn golem fills less of the cell — scale up for on-screen height. */
export const TESTER_GOLEM_DISPLAY_SCALE = ARENA_BASE_BODY_DISPLAY_SCALE * 1.5;

export const TESTER_GOLEM_ARENA_HERO_ID = 'hero_tester_golem';

/** Hand-drawn strip sprites in assets/brawlerHeroes/golem/. */
export const TESTER_GOLEM_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: TESTER_GOLEM_ARENA_HERO_ID,
  framePx: TESTER_GOLEM_FRAME_PX,
  displayScale: TESTER_GOLEM_DISPLAY_SCALE,
  /** Physics body uses base arena scale; sprite is drawn larger with feet alignment. */
  bodyScale: ARENA_BASE_BODY_DISPLAY_SCALE,
  feetSheetPx: 116,
  attackHitFromTopPx: 40,
  hitAnchorOffsetX: 0,
  hitFineOffsetSheetPx: { right: 0, left: 0 },
  strips: {
    idleRight: {
      source: require('../../assets/brawlerHeroes/golem/idle_right.webp'),
      frameCount: 4,
    },
    idleLeft: {
      source: require('../../assets/brawlerHeroes/golem/idle_left.webp'),
      frameCount: 4,
    },
    walkRight: {
      source: require('../../assets/brawlerHeroes/golem/walk_right.webp'),
      frameCount: 8,
    },
    walkLeft: {
      source: require('../../assets/brawlerHeroes/golem/walk_left.webp'),
      frameCount: 8,
    },
    attackRight: {
      source: require('../../assets/brawlerHeroes/golem/attack_right.webp'),
      frameCount: 12,
    },
    attackLeft: {
      source: require('../../assets/brawlerHeroes/golem/attack_left.webp'),
      frameCount: 12,
    },
    jumpRight: {
      source: require('../../assets/brawlerHeroes/golem/jump_right.webp'),
      frameCount: 5,
    },
    jumpLeft: {
      source: require('../../assets/brawlerHeroes/golem/jump_left.webp'),
      frameCount: 5,
    },
    dashRight: {
      source: require('../../assets/brawlerHeroes/golem/dash_right.webp'),
      frameCount: 4,
    },
    dashLeft: {
      source: require('../../assets/brawlerHeroes/golem/dash_left.webp'),
      frameCount: 4,
    },
  },
};
