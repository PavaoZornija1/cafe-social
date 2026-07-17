import { buildFinalizeFromCombat } from './brawler-combat-finalize';
import { createEmptyCombatState } from './brawler-combat.types';

describe('two-human combat finalize agreement', () => {
  it('buildFinalizeFromCombat agrees on winner for two humans', () => {
    const state = createEmptyCombatState({
      sessionId: 's-pvp',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [
        {
          participantId: 'human-a',
          playerId: 'p-a',
          isBot: false,
          x: 0.3,
          y: 0.8,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 20,
          maxHp: 100,
          alive: true,
          kills: 1,
          deaths: 0,
          cooldowns: {},
          buffs: [],
        },
        {
          participantId: 'human-b',
          playerId: 'p-b',
          isBot: false,
          x: 0.7,
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
    state.endReason = 'KO';
    state.winnerParticipantId = 'human-a';

    const payload = buildFinalizeFromCombat(state);
    expect(payload.winnerParticipantId).toBe('human-a');
    expect(payload.participants.find((p) => p.participantId === 'human-a')?.result).toBe(
      'WIN',
    );
    expect(payload.participants.find((p) => p.participantId === 'human-b')?.result).toBe(
      'LOSS',
    );
  });
});
