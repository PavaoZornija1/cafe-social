import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reconcileCombatSnapshot } from '../combatRealtime.ts';

describe('reconcileCombatSnapshot', () => {
  it('maps normalized fighters to pixels and local stats', () => {
    const result = reconcileCombatSnapshot({
      localParticipantId: 'p1',
      worldW: 1000,
      worldH: 500,
      bodyH: 50,
      state: {
        v: 1,
        sessionId: 's1',
        rev: 2,
        status: 'ACTIVE',
        startedAtMs: 0,
        endsAtMs: 1,
        tick: 3,
        world: { w: 1, h: 1 },
        fighters: [
          {
            participantId: 'p1',
            playerId: 'pl',
            isBot: false,
            x: 0.25,
            y: 0.8,
            vx: 0,
            vy: 0,
            facing: 1,
            hp: 70,
            maxHp: 100,
            alive: true,
            kills: 1,
            deaths: 0,
          },
        ],
      },
    });
    assert.equal(result.ended, false);
    assert.equal(result.localHp, 70);
    assert.equal(result.localKills, 1);
    assert.equal(result.fighterPixels[0]?.x, 250);
    assert.equal(result.fighterPixels[0]?.y, 350);
  });

  it('flags ended matches', () => {
    const result = reconcileCombatSnapshot({
      localParticipantId: null,
      worldW: 100,
      worldH: 100,
      bodyH: 10,
      state: {
        v: 1,
        sessionId: 's1',
        rev: 9,
        status: 'ENDED',
        startedAtMs: 0,
        endsAtMs: 1,
        tick: 99,
        world: { w: 1, h: 1 },
        fighters: [],
        winnerParticipantId: 'p1',
        endReason: 'KO',
      },
    });
    assert.equal(result.ended, true);
    assert.equal(result.winnerParticipantId, 'p1');
  });
});
