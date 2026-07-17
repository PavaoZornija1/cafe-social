import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { rollbackOptimisticPowerupPick } from '../powerupPickupRollback.ts';

describe('rollbackOptimisticPowerupPick', () => {
  it('restores HP from hpBeforeHeal for HEAL', () => {
    const out = rollbackOptimisticPowerupPick({
      def: { effectType: 'HEAL_MAX_HP_PCT', magnitude: 0.25 },
      powerupId: 'heal',
      heroHp: 100,
      maxHp: 100,
      activeBuffs: [],
      hpBeforeHeal: 70,
    });
    assert.equal(out.heroHp, 70);
  });

  it('removes the buff for non-heal effects', () => {
    const out = rollbackOptimisticPowerupPick({
      def: { effectType: 'MOVE_SPEED_MULT', magnitude: 1.25 },
      powerupId: 'speed',
      heroHp: 80,
      maxHp: 100,
      activeBuffs: [
        {
          powerupId: 'speed',
          effectType: 'MOVE_SPEED_MULT',
          magnitude: 1.25,
          startedAtMs: 1,
          endsAtMs: 2,
        },
        {
          powerupId: 'other',
          effectType: 'JUMP_MULT',
          magnitude: 1.1,
          startedAtMs: 1,
          endsAtMs: 2,
        },
      ],
    });
    assert.equal(out.heroHp, 80);
    assert.equal(out.activeBuffs.length, 1);
    assert.equal(out.activeBuffs[0]!.powerupId, 'other');
  });
});
