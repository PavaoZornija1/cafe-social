import type { ImageSourcePropType } from 'react-native';

export type HeroStripAnim = {
  source: ImageSourcePropType;
  frameCount: number;
};

/** Per-animation horizontal strip PNGs (one row of equal 128px frames). */
export type HeroSpriteStripMap = {
  idleRight: HeroStripAnim;
  idleLeft: HeroStripAnim;
  walkRight: HeroStripAnim;
  walkLeft: HeroStripAnim;
  attackRight?: HeroStripAnim;
  attackLeft?: HeroStripAnim;
  jumpRight?: HeroStripAnim;
  jumpLeft?: HeroStripAnim;
  dashRight?: HeroStripAnim;
  dashLeft?: HeroStripAnim;
};

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
  /** Combined spritesheet PNG (legacy heroes). Omit when `strips` is set. */
  source?: ImageSourcePropType;
  sheetPx?: { width: number; height: number };
  framePx: { w: number; h: number };
  /** Screen pixels per one sheet pixel (display size ≈ frame × displayScale). */
  displayScale: number;
  /** Collision / platform body scale when art is scaled separately (defaults to displayScale). */
  bodyScale?: number;
  /** Feet row in sheet pixels for aligning sprite draw to physics body (default: frame height). */
  feetSheetPx?: number;
  /** Attack hitbox top offset from playerY in screen px (default: arena ATTACK_HIT_Y_FROM_TOP). */
  attackHitFromTopPx?: number;
  /** Nudge power-up pickup center from body center (screen px). */
  pickupCenterOffsetPx?: { x: number; y: number };
  hitAnchorOffsetX: number;
  hitFineOffsetSheetPx: { right: number; left: number };
  /** Combined-sheet cell map. Omit when `strips` is set. */
  anim?: HeroSpriteAnimMap;
  /** Separate strip PNGs per animation (hand-drawn / modular heroes). */
  strips?: HeroSpriteStripMap;
};

export type HeroSpriteAnim = 'idle' | 'walk' | 'jump' | 'hit' | 'dash';
