import type { HeroSpriteAnim, HeroSpriteConfig } from './heroSpriteTypes';
import { ATTACK_HIT_Y_FROM_TOP } from './arena/constants';

export function getBodyScale(
  config: HeroSpriteConfig | null | undefined,
): number {
  return config?.bodyScale ?? config?.displayScale ?? 0.61875;
}

/** Vertical offset for sprite draw so sheet feet align with physics body bottom. */
export function getSpriteDrawOffsetY(
  config: HeroSpriteConfig | null | undefined,
): number {
  if (!config) return 0;
  const bodyH = config.framePx.h * getBodyScale(config);
  const feetSheet = config.feetSheetPx ?? config.framePx.h;
  return bodyH - feetSheet * config.displayScale;
}

export function getAttackHitFromTopPx(
  config: HeroSpriteConfig | null | undefined,
): number {
  return config?.attackHitFromTopPx ?? ATTACK_HIT_Y_FROM_TOP;
}

export function getPickupCenter(
  config: HeroSpriteConfig | null | undefined,
  playerX: number,
  playerY: number,
  bodyW: number,
  bodyH: number,
): { hx: number; hy: number } {
  const ox = config?.pickupCenterOffsetPx?.x ?? 0;
  const oy = config?.pickupCenterOffsetPx?.y ?? 0;
  return {
    hx: playerX + bodyW / 2 + ox,
    hy: playerY + bodyH / 2 + oy,
  };
}

export function usesStripSprites(
  config: HeroSpriteConfig | null | undefined,
): boolean {
  return config?.strips != null;
}

export function getWalkFrameCount(
  config: HeroSpriteConfig | null | undefined,
): number {
  if (config?.strips) return config.strips.walkRight.frameCount;
  return config?.anim?.walkRight.frameCount ?? 6;
}

export function getIdleFrameCount(
  config: HeroSpriteConfig | null | undefined,
): number {
  if (config?.strips) return config.strips.idleRight.frameCount;
  return 1;
}

export function getAttackFrameCount(
  config: HeroSpriteConfig | null | undefined,
): number {
  if (config?.strips?.attackRight) return config.strips.attackRight.frameCount;
  return config?.anim?.attackRight?.frameCount ?? 1;
}

export function getStripForAnim(
  config: HeroSpriteConfig,
  anim: HeroSpriteAnim,
  facing: 'left' | 'right',
) {
  const strips = config.strips;
  if (!strips) return undefined;

  const right = facing === 'right';
  switch (anim) {
    case 'walk':
      return right ? strips.walkRight : strips.walkLeft;
    case 'idle':
      return right ? strips.idleRight : strips.idleLeft;
    case 'hit':
      return right
        ? (strips.attackRight ?? strips.idleRight)
        : (strips.attackLeft ?? strips.idleLeft);
    case 'jump':
      return right
        ? (strips.jumpRight ?? strips.idleRight)
        : (strips.jumpLeft ?? strips.idleLeft);
    case 'dash':
      return right
        ? (strips.dashRight ?? strips.idleRight)
        : (strips.dashLeft ?? strips.idleLeft);
    default:
      return right ? strips.idleRight : strips.idleLeft;
  }
}
