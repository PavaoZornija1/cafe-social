import type { ActiveBuff, BrawlerPowerupDef } from './types';

type RollbackDef = Pick<BrawlerPowerupDef, 'effectType' | 'magnitude'>;

/** Revert optimistic buff/heal applied for a rejected power-up pick. */
export function rollbackOptimisticPowerupPick(params: {
  def: RollbackDef;
  powerupId: string;
  heroHp: number;
  maxHp: number;
  activeBuffs: ActiveBuff[];
  /** HP before optimistic heal (preferred for HEAL rollback). */
  hpBeforeHeal?: number;
}): { heroHp: number; activeBuffs: ActiveBuff[] } {
  const { def, powerupId, heroHp, maxHp, activeBuffs, hpBeforeHeal } = params;
  if (def.effectType === 'HEAL_MAX_HP_PCT') {
    if (typeof hpBeforeHeal === 'number') {
      return {
        heroHp: Math.max(0, Math.min(maxHp, hpBeforeHeal)),
        activeBuffs,
      };
    }
    const gain = Math.round(maxHp * def.magnitude);
    return {
      heroHp: Math.max(0, Math.min(maxHp, heroHp - gain)),
      activeBuffs,
    };
  }
  return {
    heroHp,
    activeBuffs: activeBuffs.filter((b) => b.powerupId !== powerupId),
  };
}
