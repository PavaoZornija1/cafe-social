/**
 * Mirror of app powerupCoords — server stores spawn positions as fractions of world W/H
 * so each client denormalizes to its local arena size.
 */
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
