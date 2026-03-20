/**
 * Local bruiser spritesheet (1152×4224). Frame grid is tunable — adjust rows/cols
 * if animation doesn’t line up in-game.
 */
export const BRUISER_SHEET_PX = { width: 1152, height: 4224 } as const;

/** Base cell size for idle/walk/jump/dash clips (64×64 grid). */
export const BRUISER_FRAME_PX = { w: 64, h: 64 } as const;

/**
 * Heavy club swing rows (bottom band, e.g. 62–65 on full sheet = Down, Right, Up, Left).
 *
 * **Not the same grid as walk/dash:** Those use a tight 64×64 (or 6×64-wide) strip.
 * Each weapon row is **1152px wide** with **5** wide frames (big padding for the club trail).
 * Stepping by 192×6 was wrong — that lands in empty padding / wrong frames.
 *
 * Horizontal layout: `230 + 230 + 230 + 230 + 232 === 1152` (full row).
 * If your export differs, retune `frameStarts` / `frameWidths`.
 */
export const BRUISER_WEAPON_HIT = {
  rowRight: 65,
  rowLeft: 63,
  frameHeight: 64,
  frameCount: 5,
  /** Left edge of each frame in sheet pixels (same row). */
  frameStarts: [0, 230, 460, 690, 920] as const,
  /** Width of each frame; must sum to sheet width 1152. */
  frameWidths: [230, 230, 230, 230, 232] as const,
} as const;

/** Widest hit frame — used for arena clamping and body anchor. */
export const BRUISER_WEAPON_HIT_MAX_FRAME_WIDTH_PX = Math.max(
  ...BRUISER_WEAPON_HIT.frameWidths,
);

/**
 * Nudge draw position so ~64px body lines up with idle (wide strip is centered-ish).
 * Uses max frame width so bounds stay conservative when frame width varies.
 */
export const BRUISER_HIT_ANCHOR_OFFSET_X =
  (BRUISER_WEAPON_HIT_MAX_FRAME_WIDTH_PX - BRUISER_FRAME_PX.w) / 2;

/**
 * Extra horizontal nudge in **sheet pixels** (before scale), per facing.
 * Negative = shift draw further left on screen.
 */
export const BRUISER_HIT_FINE_OFFSET_SHEET_PX = {
  right: 0,
  left: 0,
} as const;

/**
 * This sheet’s rows are ordered **Down, Right, Up, Left** per band:
 * - Idle: rows 0–3
 * - Walk: rows 4–7 (6 frames each)
 * - Dash slide: rows 52–55
 */
export const BRUISER_ANIM = {
  /** Profile facing right — uses sheet’s “Left” row (mirrored labeling on asset) */
  idleRight: { row: 3, col: 1 },
  idleLeft: { row: 1, col: 1 },
  walkRight: { row: 7, startCol: 0, frameCount: 6 },
  walkLeft: { row: 5, startCol: 0, frameCount: 6 },
  /** Airborne — use mid-walk frame as lift pose until a jump row exists */
  jumpRight: { row: 7, col: 2 },
  jumpLeft: { row: 5, col: 2 },
  /** Lunge / slide (dash band) — col 1 is usually a stable mid-lunge vs col 2 */
  dashRight: { row: 55, col: 1 },
  dashLeft: { row: 53, col: 1 },
} as const;

/** Hero id that uses `assets/bruiser-spritesheet.png` in the arena. */
export const BRUISER_ARENA_HERO_ID = 'hero_blaze';
