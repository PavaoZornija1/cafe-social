import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  arenaHudSpriteKey,
  shouldBumpArenaHud,
  type ArenaHudBumpSignals,
} from '../arenaHudBumpPolicy.ts';

function base(over: Partial<ArenaHudBumpSignals> = {}): ArenaHudBumpSignals {
  return {
    matchClockCeil: 60,
    preMatchCeil: 0,
    heroHp: 100,
    kills: 0,
    deaths: 0,
    spriteKey: 'idle:0:0:0:0:0:right',
    enemyAliveKey: '1',
    powerupKey: '',
    buffKey: '',
    dashReady: true,
    ...over,
  };
}

describe('shouldBumpArenaHud', () => {
  it('bumps on first sample', () => {
    assert.equal(shouldBumpArenaHud(null, base()), true);
  });

  it('stays quiet when motion-only signals are unchanged', () => {
    const a = base();
    assert.equal(shouldBumpArenaHud(a, { ...a }), false);
  });

  it('bumps when clock second or HP changes', () => {
    const a = base();
    assert.equal(shouldBumpArenaHud(a, base({ matchClockCeil: 59 })), true);
    assert.equal(shouldBumpArenaHud(a, base({ heroHp: 90 })), true);
  });

  it('bumps when sprite frame key changes', () => {
    const a = base();
    assert.equal(
      shouldBumpArenaHud(
        a,
        base({
          spriteKey: arenaHudSpriteKey({
            anim: 'walk',
            walk: 1,
            idle: 0,
            hit: 0,
            jump: 0,
            dash: 0,
            facing: 'right',
          }),
        }),
      ),
      true,
    );
  });
});
