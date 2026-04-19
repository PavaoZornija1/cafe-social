import type { AppColors } from './colors';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace(/^#/, '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function parseRgba(s: string): { r: number; g: number; b: number; a: number } | null {
  const m = s.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
  );
  if (!m) return null;
  return {
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    a: m[4] === undefined ? 1 : Number(m[4]),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendChannel(c1: string, c2: string, t: number): string {
  const h1 = hexToRgb(c1);
  const h2 = hexToRgb(c2);
  if (h1 && h2) {
    return rgbToHex(lerp(h1.r, h2.r, t), lerp(h1.g, h2.g, t), lerp(h1.b, h2.b, t));
  }
  const r1 = parseRgba(c1);
  const r2 = parseRgba(c2);
  if (r1 && r2) {
    return `rgba(${Math.round(lerp(r1.r, r2.r, t))}, ${Math.round(lerp(r1.g, r2.g, t))}, ${Math.round(lerp(r1.b, r2.b, t))}, ${lerp(r1.a, r2.a, t)})`;
  }
  return t < 0.5 ? c1 : c2;
}

/** Linear blend between two full palettes (0 = a, 1 = b). */
export function blendPalettes(a: AppColors, b: AppColors, t: number): AppColors {
  const u = Math.max(0, Math.min(1, t));
  const keys = Object.keys(a) as (keyof AppColors)[];
  const out = { ...a };
  for (const k of keys) {
    out[k] = blendChannel(a[k], b[k], u);
  }
  return out;
}
