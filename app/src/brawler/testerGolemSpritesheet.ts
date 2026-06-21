import type { HeroSpriteConfig } from './heroSpriteTypes';
import { GORGON_DISPLAY_SCALE } from './bruiserSpritesheet';

export const TESTER_GOLEM_FRAME_PX = { w: 128, h: 128 } as const;

/** Hand-drawn golem fills less of the cell — scale up vs Gorgon on-screen height. */
export const TESTER_GOLEM_DISPLAY_SCALE = GORGON_DISPLAY_SCALE * 1.5;

export const TESTER_GOLEM_ARENA_HERO_ID = 'hero_tester_golem';

/** Hand-drawn strip sprites in assets/brawlerHeroes/bruiser/. */
export const TESTER_GOLEM_HERO_SPRITE_CONFIG: HeroSpriteConfig = {
  heroId: TESTER_GOLEM_ARENA_HERO_ID,
  framePx: TESTER_GOLEM_FRAME_PX,
  displayScale: TESTER_GOLEM_DISPLAY_SCALE,
  /** Physics body stays Gorgon-sized; sprite is drawn larger with feet alignment. */
  bodyScale: GORGON_DISPLAY_SCALE,
  feetSheetPx: 116,
  attackHitFromTopPx: 40,
  hitAnchorOffsetX: 0,
  hitFineOffsetSheetPx: { right: 0, left: 0 },
  strips: {
    idleRight: {
      source: require('../../assets/brawlerHeroes/bruiser/idle_right.png'),
      frameCount: 3,
    },
    idleLeft: {
      source: require('../../assets/brawlerHeroes/bruiser/idle_left.png'),
      frameCount: 3,
    },
    walkRight: {
      source: require('../../assets/brawlerHeroes/bruiser/walk_right.png'),
      frameCount: 8,
    },
    walkLeft: {
      source: require('../../assets/brawlerHeroes/bruiser/walk_left.png'),
      frameCount: 8,
    },
  },
};
