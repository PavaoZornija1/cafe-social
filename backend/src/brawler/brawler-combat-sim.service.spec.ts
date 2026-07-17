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
      writeState: jest.fn(async (s: Record<string, unknown>) => ({
      ...s,
      rev: Number(s.rev ?? 0) + 1,
    })),
    };
    const events = { emit: jest.fn() };
    const svc = new BrawlerCombatSimService(
      combat as never,
      events as unknown as EventEmitter2,
    );
    return { svc, combat, events };
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
          x: 0.2,
          y: 0.8,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 100,
          maxHp: 100,
          alive: true,
          kills: 0,
          deaths: 0,
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
