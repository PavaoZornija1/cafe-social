import { buildFinalizeFromCombat } from './brawler-combat-finalize';
import { createEmptyCombatState } from './brawler-combat.types';

describe('buildFinalizeFromCombat', () => {
  it('maps winner and K/D from combat fighters', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [
        {
          participantId: 'a',
          playerId: 'p1',
          isBot: false,
          x: 0.2,
          y: 0.8,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 40,
          maxHp: 100,
          alive: true,
          kills: 2,
          deaths: 0,
          cooldowns: {},
          buffs: [],
        },
        {
          participantId: 'b',
          playerId: null,
          isBot: true,
          x: 0.8,
          y: 0.8,
          vx: 0,
          vy: 0,
          facing: -1,
          hp: 0,
          maxHp: 100,
          alive: false,
          kills: 0,
          deaths: 1,
          cooldowns: {},
          buffs: [],
        },
      ],
    });
    state.status = 'ENDED';
    state.winnerParticipantId = 'a';
    state.endReason = 'KO';

    const payload = buildFinalizeFromCombat(state);
    expect(payload.winnerParticipantId).toBe('a');
    expect(payload.participants).toEqual([
      expect.objectContaining({
        participantId: 'a',
        result: 'WIN',
        kills: 2,
        deaths: 0,
        placement: 1,
      }),
      expect.objectContaining({
        participantId: 'b',
        result: 'LOSS',
        kills: 0,
        deaths: 1,
        placement: 2,
      }),
    ]);
  });

  it('rejects ACTIVE combat', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [],
    });
    expect(() => buildFinalizeFromCombat(state)).toThrow(/not ended/);
  });
});
