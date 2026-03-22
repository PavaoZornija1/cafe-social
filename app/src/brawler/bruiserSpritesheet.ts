/**
 * Local bruiser spritesheet (1152×4224). Frame grid is tunable — adjust rows/cols
 * if animation doesn’t line up in-game.
 */
export const BRUISER_SHEET_PX = { width: 1152, height: 4224 } as const;

/** Base cell size for idle/walk/jump/dash clips (64×64 grid). */
export const BRUISER_FRAME_PX = { w: 64, h: 64 } as const;

/** Hit uses `BRUISER_ANIM.dashRight` in `BruiserSpriteView` until a proper melee strip is wired. */
export const BRUISER_HIT_ANCHOR_OFFSET_X = 0;

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
