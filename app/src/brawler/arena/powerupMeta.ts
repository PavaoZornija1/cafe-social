import type { BrawlerPowerupDef } from './types';

export const POWERUP_EFFECT_COLORS: Record<BrawlerPowerupDef['effectType'], string> = {
  MOVE_SPEED_MULT: '#22d3ee',
  ATTACK_DMG_MULT: '#f97316',
  JUMP_MULT: '#22c55e',
  DASH_SPEED_MULT: '#eab308',
  DASH_COOLDOWN_MULT: '#a78bfa',
};

export const POWERUP_EFFECT_LABELS: Record<BrawlerPowerupDef['effectType'], string> = {
  MOVE_SPEED_MULT: 'Move speed',
  ATTACK_DMG_MULT: 'Attack damage',
  JUMP_MULT: 'Jump height',
  DASH_SPEED_MULT: 'Dash speed',
  DASH_COOLDOWN_MULT: 'Dash cooldown',
};
