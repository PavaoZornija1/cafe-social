import type { AppColors } from './colors';
import { blendPalettes } from './colorMath';
import { paletteDay, paletteDusk, paletteEvening, paletteMorning } from './palettes';

export type DayPhase = 'morning' | 'day' | 'dusk' | 'evening';

/** Minutes from local midnight, fractional */
function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Phase for labeling / debugging (discrete bucket).
 * Morning: 05:00–12:00, Day: 12:00–17:00, Dusk: 17:00–19:00, Evening: 19:00–05:00
 * (Dusk is a fixed “golden hour” window; real sunset varies by place and season.)
 */
export function getDayPhase(date: Date): DayPhase {
  const m = minutesSinceMidnight(date);
  if (m >= 5 * 60 && m < 12 * 60) return 'morning';
  if (m >= 12 * 60 && m < 17 * 60) return 'day';
  if (m >= 17 * 60 && m < 19 * 60) return 'dusk';
  return 'evening';
}

const BLEND_MIN = 30;

/**
 * Palettes cross-fade at hand-offs so transitions feel gradual.
 * - 04:30–05:00 evening → morning
 * - 11:30–12:00 morning → day
 * - 16:30–17:00 day → dusk
 * - 18:30–19:00 dusk → evening
 */
export function getColorsAt(date: Date): AppColors {
  const m = minutesSinceMidnight(date);

  if (m >= 4.5 * 60 && m < 5 * 60) {
    const t = (m - 4.5 * 60) / BLEND_MIN;
    return blendPalettes(paletteEvening, paletteMorning, t);
  }
  if (m >= 11.5 * 60 && m < 12 * 60) {
    const t = (m - 11.5 * 60) / BLEND_MIN;
    return blendPalettes(paletteMorning, paletteDay, t);
  }
  if (m >= 16.5 * 60 && m < 17 * 60) {
    const t = (m - 16.5 * 60) / BLEND_MIN;
    return blendPalettes(paletteDay, paletteDusk, t);
  }
  if (m >= 18.5 * 60 && m < 19 * 60) {
    const t = (m - 18.5 * 60) / BLEND_MIN;
    return blendPalettes(paletteDusk, paletteEvening, t);
  }

  const phase = getDayPhase(date);
  if (phase === 'morning') return paletteMorning;
  if (phase === 'day') return paletteDay;
  if (phase === 'dusk') return paletteDusk;
  return paletteEvening;
}
