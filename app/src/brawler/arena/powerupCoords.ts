/** Server stores/broadcasts power-up positions as fractions of world W/H. */

export function normalizePowerupCoords(
  x: number,
  y: number,
  worldW: number,
  worldH: number,
): { nx: number; ny: number } {
  const w = Math.max(1, worldW);
  const h = Math.max(1, worldH);
  return { nx: x / w, ny: y / h };
}

export function denormalizePowerupCoords(
  nx: number,
  ny: number,
  worldW: number,
  worldH: number,
): { x: number; y: number } {
  return {
    x: Math.round(nx * worldW),
    y: Math.round(ny * worldH),
  };
}

export function denormalizeArenaSpawn<T extends { nx: number; ny: number; r?: number }>(
  spawn: T,
  worldW: number,
  worldH: number,
): Omit<T, 'nx' | 'ny'> & { x: number; y: number } {
  const { nx, ny, ...rest } = spawn;
  const { x, y } = denormalizePowerupCoords(nx, ny, worldW, worldH);
  return { ...rest, x, y };
}
