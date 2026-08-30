// See brawler.service.spec.ts — venue helpers transitively import `@turf/turf` (ESM).
jest.mock('../venue/venue.service', () => ({ VenueService: class VenueService {} }));
jest.mock('../venue/venue-play-limit.service', () => ({
  VenuePlayLimitService: class VenuePlayLimitService {},
}));
jest.mock('../venue/venue-play-budget.service', () => ({
  VenuePlayBudgetService: class VenuePlayBudgetService {},
}));

import { EventEmitter2 } from '@nestjs/event-emitter';
import { BrawlerCombatSimService } from './brawler-combat-sim.service';
import { createEmptyCombatState } from './brawler-combat.types';
import { BRAWLER_COMBAT_EVENT } from './brawler-combat.events';

describe('BrawlerCombatSimService', () => {
  function build() {
    const combat = {
      tryAcquireTickLock: jest.fn().mockResolvedValue(true),
      renewTickLock: jest.fn().mockResolvedValue(true),
      releaseTickLock: jest.fn().mockResolvedValue(true),
      readState: jest.fn(),
      readPresence: jest.fn().mockResolvedValue({}),
      writeState: jest.fn(async (s: Record<string, unknown>) => ({
      ...s,
      rev: Number(s.rev ?? 0) + 1,
    })),
    };
    const brawler = {
      forfeitIdleMs: () => 30_000,
      applyCombatForfeits: jest.fn().mockResolvedValue(null),
    };
    const events = { emit: jest.fn() };
    const svc = new BrawlerCombatSimService(
      combat as never,
      events as unknown as EventEmitter2,
      brawler as never,
    );
    return { svc, combat, events, brawler };
  }

  it('rate-limits burst inputs', () => {
    const { svc } = build();
    let accepted = 0;
    for (let i = 0; i < 50; i++) {
      if (
        svc.enqueueInput('s1', {
          participantId: 'p1',
          seq: i,
          moveX: 1,
          moveY: 0,
        })
      ) {
        accepted += 1;
      }
    }
    expect(accepted).toBe(40);
  });

  it('auto-forfeits idle humans before stepping combat', async () => {
    const { svc, combat, brawler } = build();
    const nowMs = Date.now();
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: nowMs - 60_000,
      endsAtMs: nowMs + 60_000,
      fighters: [
        {
          participantId: 'p1',
          playerId: 'pl1',
          isBot: false,
          x: 200,
          y: 800,
          prevY: 800,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 100,
          maxHp: 100,
          alive: true,
          kills: 0,
          deaths: 0,
          onGround: true,
          airJumpsLeft: 1,
          iFramesLeftTicks: 0,
          meleeReadyTick: 0,
          dashTimeLeftTicks: 0,
          dashCooldownLeftTicks: 0,
          attackTimeLeftTicks: 0,
          moveSpeedMul: 1,
          attackDamage: 14,
          dashCooldownTicks: 44,
          cooldowns: {},
          buffs: [],
        },
        {
          participantId: 'p2',
          playerId: 'pl2',
          isBot: false,
          x: 400,
          y: 800,
          prevY: 800,
          vx: 0,
          vy: 0,
          facing: -1,
          hp: 100,
          maxHp: 100,
          alive: true,
          kills: 0,
          deaths: 0,
          onGround: true,
          airJumpsLeft: 1,
          iFramesLeftTicks: 0,
          meleeReadyTick: 0,
          dashTimeLeftTicks: 0,
          dashCooldownLeftTicks: 0,
          attackTimeLeftTicks: 0,
          moveSpeedMul: 1,
          attackDamage: 14,
          dashCooldownTicks: 44,
          cooldowns: {},
          buffs: [],
        },
      ],
    });
    combat.readState.mockResolvedValue(state);
    combat.readPresence.mockResolvedValue({
      p1: nowMs - 35_000,
      p2: nowMs - 1_000,
    });
    brawler.applyCombatForfeits.mockResolvedValue({
      ...state,
      status: 'ENDED',
      endReason: 'FORFEIT',
      winnerParticipantId: 'p2',
    });
    svc.registerSession('s1');

    await svc.tickSession('s1');

    expect(brawler.applyCombatForfeits).toHaveBeenCalledWith('s1', ['p1']);
    expect(combat.writeState).not.toHaveBeenCalled();
  });

  it('ticks under lock, writes stepped state, and emits snapshot', async () => {
    const { svc, combat, events } = build();
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      fighters: [
        {
          participantId: 'p1',
          playerId: 'pl1',
          isBot: false,
          x: 200,
          y: 800,
          prevY: 800,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 100,
          maxHp: 100,
          alive: true,
          kills: 0,
          deaths: 0,
          onGround: true,
          airJumpsLeft: 1,
          iFramesLeftTicks: 0,
          meleeReadyTick: 0,
          dashTimeLeftTicks: 0,
          dashCooldownLeftTicks: 0,
          attackTimeLeftTicks: 0,
          moveSpeedMul: 1,
          attackDamage: 14,
          dashCooldownTicks: 44,
          cooldowns: {},
          buffs: [],
        },
      ],
    });
    combat.readState.mockResolvedValue(state);
    svc.registerSession('s1');
    svc.enqueueInput('s1', {
      participantId: 'p1',
      seq: 1,
      moveX: 1,
      moveY: 0,
    });

    await svc.tickSession('s1');

    expect(combat.writeState).toHaveBeenCalled();
    const writtenArg = combat.writeState.mock.calls[0][0] as {
      tick: number;
    };
    expect(writtenArg.tick).toBe(1);
    expect(events.emit).toHaveBeenCalledWith(
      BRAWLER_COMBAT_EVENT,
      expect.objectContaining({
        sessionId: 's1',
        type: 'snapshot',
      }),
    );
  });
});
