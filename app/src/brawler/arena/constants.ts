import type { BrawlerArenaHeroStats } from '../../navigation/type';

/** Mossy tile — one stretched strip per platform hitbox. */
export const ARENA_MAP_BG = require('../../../assets/Mossy - FloatingPlatforms.webp');
/** Distant sky behind platforms and hero. */
export const ARENA_SKY_LOTTIE = require('../../../assets/lottie/Underwater Ocean Fish and Turtle.json');

export const ACTION_CIRCLE_SIZE = 66;

export const BASE_MOVE_SPEED_PX = 260;
export const GRAVITY = 2200;
export const JUMP_VELOCITY = -640;
/** Extra jumps allowed after leaving the ground (1 = double jump). */
export const MAX_AIR_JUMPS = 1;
/** Second jump impulse relative to the first. */
export const DOUBLE_JUMP_VELOCITY_MUL = 0.9;
/** Stick Y above this (pull down) while grounded drops through floating platforms. */
export const DROP_THROUGH_JOY_THRESHOLD = 0.35;
/** Downward nudge when starting a drop-through (px/s). */
export const DROP_THROUGH_INITIAL_VY = 200;
/** Feet must pass this far below the platform slab before it becomes solid again. */
export const DROP_THROUGH_CLEARANCE_PX = 8;
export const GROUND_STRIP_H = 40;
export const WALK_FRAME_MS = 140;
export const IDLE_FRAME_MS = 400;

export const DUMMY_W = 52;
export const DUMMY_H = 52;
export const DUMMY_HP_MAX = 100;
export const DUMMY_RESPAWN_DELAY_S = 1.2;

export const HERO_IFRAMES_S = 0.65;

export const ENEMY_HP_MAX = 60;
export const ENEMY_IFRAMES_S = 0.25;
export const ENEMY_RESPAWN_DELAY_S = 1.4;

export const ENEMY_W = 46;
export const ENEMY_H = 46;
export const ENEMY_SPEED = 45;

export const ATTACK_HIT_W = 46;
export const ATTACK_HIT_H = 34;
export const ATTACK_HIT_FORWARD = 10;
export const ATTACK_HIT_Y_FROM_TOP = 18;

export const DEFAULT_SHOW_ATTACK_HITBOX_DEBUG = true;

export const DMG_FLOAT_LIFETIME_S = 0.65;
export const DMG_FLOAT_RISE_PX = 26;

export const DEFAULT_MATCH_TIMER_ENABLED = false;

export const ATTACK_DURATION_S = 0.28;
/** Horizontal move speed multiplier while a swing is active (still steerable). */
export const ATTACK_MOVE_SPEED_MUL = 1;
export const MOVE_ACCEL = 24;
export const MOVE_DECEL = 16;
export const MOVE_ACCEL_ATTACK = 18;
export const MOVE_DECEL_ATTACK = 14;
export const DASH_DURATION_S = 0.18;
export const DASH_SPEED = 560;

export const POWERUP_SPAWN_INTERVAL_S = 6.5;
export const POWERUP_MAX_ON_MAP = 3;
export const POWERUP_PICKUP_RADIUS_PX = 28;

export const FALLBACK_ARENA_HERO_STATS: BrawlerArenaHeroStats = {
  baseHp: 100,
  moveSpeed: 1.0,
  dashCooldownMs: 2200,
  attackDamage: 14,
  attackKnockback: 1.0,
};

export const MARGIN_SCREEN = 20;
export const JOYSTICK_SIZE = 124;

export const PRE_MATCH_COUNTDOWN_S = 5;
export const DEFAULT_MATCH_PHASE_CHAOS_END_S = 60;
export const DEFAULT_MATCH_PHASE_ENDGAME_END_S = 75;
export const DEFAULT_MATCH_MAX_S = 90;

export const ACTION_ARC_W = 220;
export const ACTION_ARC_H = 120;
export const ACTION_ARC_R = 72;
export const ACTION_ARC_CENTER_X = 132;
export const ACTION_ARC_CENTER_Y = ACTION_ARC_H - 10;
export const ACTION_ARC_ANGLES_HIT_DASH_JUMP = [156, 93, 32] as const;

export const ACTION_CONTROLS_SAFE_RIGHT_NUDGE_PX = 28;
export const ACTION_CONTROLS_RIGHT_GUTTER = 18;
export const ACTION_CONTROLS_BOTTOM_GUTTER = 12;
export const ACTION_CONTROLS_LEFT_GUTTER = 12;
