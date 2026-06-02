import type { PlatformWorld } from '../arenaPlatforms';

export function overlapX(
  ax: number,
  aw: number,
  p: Pick<PlatformWorld, 'x' | 'w'>,
  inset = 4,
): boolean {
  return ax + aw > p.x + inset && ax < p.x + p.w - inset;
}

export function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
