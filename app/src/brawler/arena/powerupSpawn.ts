import { buildArenaPlatforms } from '../arenaPlatforms';
import { GROUND_STRIP_H, POWERUP_PICKUP_RADIUS_PX } from './constants';

/** Hero torso center height above platform top when standing (matches typical sprite scale). */
const POWERUP_CENTER_ABOVE_PLATFORM_PX = 22;

export function pickRandomPowerupSpawnPosition(
  worldW: number,
  worldH: number,
): { x: number; y: number } | null {
  const plats = buildArenaPlatforms(worldW, worldH, GROUND_STRIP_H, 4);
  const minPlatformW = POWERUP_PICKUP_RADIUS_PX * 2 + 8;
  const valid = plats.filter((p) => p.w >= minPlatformW);
  if (!valid.length) return null;

  const edgePad = POWERUP_PICKUP_RADIUS_PX + 4;
  for (let attempt = 0; attempt < 16; attempt++) {
    const platform = valid[Math.floor(Math.random() * valid.length)]!;
    const xMin = platform.x + edgePad;
    const xMax = platform.x + platform.w - edgePad;
    if (xMax <= xMin) continue;
    const x = Math.round(xMin + Math.random() * (xMax - xMin));
    const y = Math.round(platform.y - POWERUP_CENTER_ABOVE_PLATFORM_PX);
    if (y < 0 || y > worldH) continue;
    return { x, y };
  }
  return null;
}
