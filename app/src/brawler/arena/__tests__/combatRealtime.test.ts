import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reconcileCombatSnapshot } from '../combatRealtime.ts';
import {
  RemoteFighterInterpolator,
  reconcileLocalPosition,
} from '../remoteFighters.ts';

describe('reconcileCombatSnapshot', () => {
  it('maps pixel fighters and remote list for v2 state', () => {
    const result = reconcileCombatSnapshot({
      localParticipantId: 'p1',
      worldW: 1000,
      worldH: 945,
      bodyH: 48,
      heroIdByParticipant: new Map([
        ['p1', 'hero-a'],
        ['p2', 'hero-b'],
      ]),
      state: {
        v: 2,
        sessionId: 's1',
        rev: 2,
        status: 'ACTIVE',
        startedAtMs: 0,
        endsAtMs: 1,
        tick: 3,
        world: { w: 936, h: 945 },
        fighters: [
          {
            participantId: 'p1',
            playerId: 'pl',
            isBot: false,
            brawlerHeroId: 'hero-a',
            x: 250,
            y: 800,
            vx: 0,
            vy: 0,
            facing: 1,
            hp: 70,
            maxHp: 100,
            alive: true,
            kills: 1,
            deaths: 0,
          },
          {
            participantId: 'p2',
            playerId: 'pl2',
            isBot: false,
            brawlerHeroId: 'hero-b',
            x: 600,
            y: 810,
            vx: 10,
            vy: 0,
            facing: -1,
            hp: 90,
            maxHp: 100,
            alive: true,
            kills: 0,
            deaths: 0,
          },
        ],
      },
    });
    assert.equal(result.fighterPixels[0]?.x, 250);
    assert.equal(result.localX, 250);
    assert.equal(result.remoteFighters.length, 1);
    assert.equal(result.remoteFighters[0]?.participantId, 'p2');
    assert.equal(result.remoteFighters[0]?.brawlerHeroId, 'hero-b');
  });

  it('reports localForfeited when server marks fighter forfeited', () => {
    const result = reconcileCombatSnapshot({
      localParticipantId: 'p1',
      worldW: 936,
      worldH: 945,
      bodyH: 48,
      state: {
        v: 2,
        sessionId: 's1',
        rev: 1,
        status: 'ACTIVE',
        startedAtMs: 0,
        endsAtMs: 60_000,
        tick: 1,
        world: { w: 936, h: 945 },
        fighters: [
          {
            participantId: 'p1',
            playerId: 'pl',
            isBot: false,
            x: 200,
            y: 800,
            vx: 0,
            vy: 0,
            facing: 1,
            hp: 0,
            maxHp: 100,
            alive: false,
            forfeited: true,
            kills: 0,
            deaths: 1,
          },
          {
            participantId: 'p2',
            playerId: 'pl2',
            isBot: false,
            x: 400,
            y: 800,
            vx: 0,
            vy: 0,
            facing: -1,
            hp: 100,
            maxHp: 100,
            alive: true,
            kills: 0,
            deaths: 0,
          },
        ],
      },
    });
    assert.equal(result.localForfeited, true);
    assert.equal(result.localAlive, false);
  });
});

describe('RemoteFighterInterpolator', () => {
  it('interpolates between two samples', () => {
    const interp = new RemoteFighterInterpolator();
    interp.ingest(
      [
        {
          participantId: 'p2',
          brawlerHeroId: 'hero-b',
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 100,
          maxHp: 100,
          alive: true,
          isBot: false,
          anim: 'idle',
        },
      ],
      0,
    );
    interp.ingest(
      [
        {
          participantId: 'p2',
          brawlerHeroId: 'hero-b',
          x: 100,
          y: 0,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 100,
          maxHp: 100,
          alive: true,
          isBot: false,
          anim: 'walk',
        },
      ],
      100,
    );
    const mid = interp.render(50);
    assert.equal(mid.length, 1);
    assert.ok(mid[0]!.displayX > 40 && mid[0]!.displayX < 60);
  });
});

describe('reconcileLocalPosition', () => {
  it('soft lerps when error is moderate', () => {
    const out = reconcileLocalPosition({
      localX: 0,
      localY: 0,
      serverX: 40,
      serverY: 0,
      thresholdPx: 24,
    });
    assert.ok(out.x > 0 && out.x < 40);
  });
});
