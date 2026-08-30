/**
 * Mirror of `app/src/brawler/arena/constants.ts` for authoritative combat sim.
 * Keep in sync when tuning arena feel.
 */
export const BASE_MOVE_SPEED_PX = 260;
export const GRAVITY = 2200;
export const JUMP_VELOCITY = -640;
export const MAX_AIR_JUMPS = 1;
export const DOUBLE_JUMP_VELOCITY_MUL = 0.9;

export const GROUND_STRIP_H = 40;
export const FLOOR_PAD = 4;
export const MARGIN_SCREEN = 20;

export const ATTACK_HIT_W = 46;
export const ATTACK_HIT_H = 34;
export const ATTACK_HIT_FORWARD = 10;
export const ATTACK_HIT_Y_FROM_TOP = 18;

export const ATTACK_DURATION_S = 0.28;
export const ATTACK_MOVE_SPEED_MUL = 1;
export const MOVE_ACCEL = 24;
export const MOVE_DECEL = 16;
export const MOVE_ACCEL_ATTACK = 18;
export const MOVE_DECEL_ATTACK = 14;

export const DASH_DURATION_S = 0.18;
export const DASH_SPEED = 560;
export const DEFAULT_DASH_COOLDOWN_S = 2.2;

export const HERO_IFRAMES_S = 0.65;
export const DEFAULT_MELEE_DAMAGE = 14;
export const MELEE_COOLDOWN_S = 0.4;

/** Reference hero body size (px) for server hitboxes / feet probe. */
export const FIGHTER_BODY_W = 48;
export const FIGHTER_BODY_H = 48;
export const FIGHTER_FEET_W = FIGHTER_BODY_W * 0.22;

/** Canonical viewport — matches client `worldW` / `worldH` ratio. */
export const DEFAULT_BRAWLER_FORFEIT_IDLE_MS = 30_000;

export const REF_ARENA_W = 390;
export const REF_ARENA_H = 700;
export const REF_WORLD_W = Math.round(REF_ARENA_W * 2.4);
export const REF_WORLD_H = Math.round(REF_ARENA_H * 1.35);

export function combatWorldFromRef(): { w: number; h: number } {
  return { w: REF_WORLD_W, h: REF_WORLD_H };
}
