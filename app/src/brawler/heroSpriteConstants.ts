/** Standard arena sprite cell size for strip-based heroes. */
export const ARENA_FRAME_PX = { w: 128, h: 128 } as const;

/** Physics body display scale (64px target height on a 128px frame). */
const ARENA_SPRITE_SCALE = 1.65 * 0.75;
export const ARENA_BASE_BODY_DISPLAY_SCALE =
  (64 * ARENA_SPRITE_SCALE) / ARENA_FRAME_PX.w;
