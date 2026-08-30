import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RemoteFighterInterpolator } from '../remoteFighters.ts';

describe('remoteFighters', () => {
  it('clears tracks when participant disappears', () => {
    const interp = new RemoteFighterInterpolator();
    interp.ingest(
      [
        {
          participantId: 'a',
          brawlerHeroId: 'h1',
          x: 1,
          y: 2,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 10,
          maxHp: 10,
          alive: true,
          isBot: false,
          anim: 'idle',
        },
      ],
      0,
    );
    interp.ingest([], 50);
    assert.equal(interp.render(50).length, 0);
  });
});
