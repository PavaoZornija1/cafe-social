import type { BrawlerArenaHeroStats } from '../../navigation/type';
import type { ActiveBuff } from './types';

export type HeroStatKey = 'speed' | 'attack' | 'dashCd' | 'jump' | 'dashSpd';

export function effectTypeToStatKey(
  effectType: ActiveBuff['effectType'],
): HeroStatKey | null {
  switch (effectType) {
    case 'MOVE_SPEED_MULT':
      return 'speed';
    case 'ATTACK_DMG_MULT':
      return 'attack';
    case 'DASH_COOLDOWN_MULT':
      return 'dashCd';
    case 'JUMP_MULT':
      return 'jump';
    case 'DASH_SPEED_MULT':
      return 'dashSpd';
    default:
      return null;
  }
}

export function activeBuffStatHighlights(
  buffs: ActiveBuff[],
  nowMs: number,
  pickupFlash: { effectType: ActiveBuff['effectType']; endsAtMs: number } | null,
): Set<HeroStatKey> {
  const keys = new Set<HeroStatKey>();
  for (const b of buffs) {
    if (b.endsAtMs <= nowMs) continue;
    const key = effectTypeToStatKey(b.effectType);
    if (key) keys.add(key);
  }
  if (pickupFlash && pickupFlash.endsAtMs > nowMs) {
    const key = effectTypeToStatKey(pickupFlash.effectType);
    if (key) keys.add(key);
  }
  return keys;
}

export function buffMultipliers(buffs: ActiveBuff[], nowMs: number) {
  return buffs.reduce(
    (acc, b) => {
      if (b.endsAtMs <= nowMs) return acc;
      if (b.effectType === 'MOVE_SPEED_MULT') acc.speed *= b.magnitude;
      if (b.effectType === 'ATTACK_DMG_MULT') acc.attack *= b.magnitude;
      if (b.effectType === 'DASH_COOLDOWN_MULT') acc.dashCd *= b.magnitude;
      if (b.effectType === 'JUMP_MULT') acc.jump *= b.magnitude;
      if (b.effectType === 'DASH_SPEED_MULT') acc.dashSpd *= b.magnitude;
      return acc;
    },
    { speed: 1, attack: 1, dashCd: 1, jump: 1, dashSpd: 1 },
  );
}

export type HeroStatRow = {
  key: HeroStatKey;
  label: string;
  value: string;
  boosted: boolean;
};

export function buildHeroStatRows(
  base: BrawlerArenaHeroStats,
  buffs: ActiveBuff[],
  nowMs: number,
  pickupFlash: { effectType: ActiveBuff['effectType']; endsAtMs: number } | null,
): HeroStatRow[] {
  const mul = buffMultipliers(buffs, nowMs);
  const highlights = activeBuffStatHighlights(buffs, nowMs, pickupFlash);

  return [
    {
      key: 'speed',
      label: 'SPD',
      value: (base.moveSpeed * mul.speed).toFixed(2),
      boosted: highlights.has('speed'),
    },
    {
      key: 'attack',
      label: 'ATK',
      value: String(Math.round(base.attackDamage * mul.attack)),
      boosted: highlights.has('attack'),
    },
    {
      key: 'dashCd',
      label: 'DASH',
      value: `${Math.round(base.dashCooldownMs * mul.dashCd)}ms`,
      boosted: highlights.has('dashCd'),
    },
    {
      key: 'jump',
      label: 'JMP',
      value: mul.jump > 1 ? `${mul.jump.toFixed(1)}x` : '1.0x',
      boosted: highlights.has('jump'),
    },
    {
      key: 'dashSpd',
      label: 'BURST',
      value: mul.dashSpd > 1 ? `${mul.dashSpd.toFixed(1)}x` : '1.0x',
      boosted: highlights.has('dashSpd'),
    },
  ];
}
