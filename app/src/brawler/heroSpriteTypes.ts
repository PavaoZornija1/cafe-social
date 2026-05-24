import type { ImageSourcePropType } from 'react-native';

export type HeroSpriteCell = { row: number; col: number };

export type HeroSpriteStrip = {
  row: number;
  startCol: number;
  frameCount: number;
};

export type HeroSpriteAnimMap = {
  idleRight: HeroSpriteCell;
  idleLeft: HeroSpriteCell;
  walkRight: HeroSpriteStrip;
  walkLeft: HeroSpriteStrip;
  jumpRight: HeroSpriteCell;
  jumpLeft: HeroSpriteCell;
  dashRight: HeroSpriteCell;
  dashLeft: HeroSpriteCell;
  attackRight?: HeroSpriteStrip;
  attackLeft?: HeroSpriteStrip;
};

export type HeroSpriteConfig = {
  heroId: string;
  source: ImageSourcePropType;
  sheetPx: { width: number; height: number };
  framePx: { w: number; h: number };
  /** Screen pixels per one sheet pixel (display size ≈ frame × displayScale). */
  displayScale: number;
  hitAnchorOffsetX: number;
  hitFineOffsetSheetPx: { right: number; left: number };
  anim: HeroSpriteAnimMap;
};

export type HeroSpriteAnim = 'idle' | 'walk' | 'jump' | 'hit' | 'dash';
