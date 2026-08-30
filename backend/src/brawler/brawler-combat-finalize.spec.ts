import { buildFinalizeFromCombat } from './brawler-combat-finalize';
import { DEFAULT_MELEE_DAMAGE } from './brawler-combat.constants';
import { createEmptyCombatState, secondsToTicks } from './brawler-combat.types';
import type { BrawlerCombatFighterV1 } from './brawler-combat.types';

function fighter(
  partial: Partial<BrawlerCombatFighterV1> & Pick<BrawlerCombatFighterV1, 'participantId'>,
): BrawlerCombatFighterV1 {
  return {
    playerId: partial.playerId ?? null,
    isBot: partial.isBot ?? false,
    x: partial.x ?? 200,
    y: partial.y ?? 800,
    prevY: partial.y ?? 800,
    vx: 0,
    vy: 0,
    facing: partial.facing ?? 1,
    hp: partial.hp ?? 100,
    maxHp: partial.maxHp ?? 100,
    alive: partial.alive ?? true,
    kills: partial.kills ?? 0,
    deaths: partial.deaths ?? 0,
    onGround: true,
    airJumpsLeft: 1,
    iFramesLeftTicks: 0,
    meleeReadyTick: 0,
    dashTimeLeftTicks: 0,
    dashCooldownLeftTicks: 0,
    attackTimeLeftTicks: 0,
    moveSpeedMul: 1,
    attackDamage: DEFAULT_MELEE_DAMAGE,
    dashCooldownTicks: secondsToTicks(2.2),
    cooldowns: {},
    buffs: [],
    ...partial,
  };
}

describe('buildFinalizeFromCombat', () => {
  it('maps winner and K/D from combat fighters', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [
        fighter({
          participantId: 'a',
          playerId: 'p1',
          hp: 40,
          kills: 2,
        }),
        fighter({
          participantId: 'b',
          isBot: true,
          hp: 0,
          alive: false,
          deaths: 1,
        }),
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

  it('preserves FORFEIT endReason in finalize payload', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [
        fighter({ participantId: 'a', playerId: 'p1', alive: true }),
        fighter({
          participantId: 'b',
          playerId: 'p2',
          hp: 0,
          alive: false,
          deaths: 1,
          forfeited: true,
        }),
      ],
    });
    state.status = 'ENDED';
    state.winnerParticipantId = 'a';
    state.endReason = 'FORFEIT';

    const payload = buildFinalizeFromCombat(state);
    expect(payload.endReason).toBe('FORFEIT');
    expect(payload.winnerParticipantId).toBe('a');
  });

  it('assigns placements 1-4 for FFA', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [
        fighter({ participantId: 'a', kills: 3, alive: true }),
        fighter({ participantId: 'b', kills: 2, alive: false, deaths: 1 }),
        fighter({ participantId: 'c', kills: 1, alive: false, deaths: 2 }),
        fighter({ participantId: 'd', kills: 0, alive: false, deaths: 3 }),
      ],
    });
    state.status = 'ENDED';
    state.winnerParticipantId = 'a';
    state.endReason = 'KO';

    const payload = buildFinalizeFromCombat(state);
    expect(payload.participants.find((p) => p.participantId === 'a')?.placement).toBe(1);
    expect(payload.participants.find((p) => p.participantId === 'b')?.placement).toBe(2);
    expect(payload.participants.find((p) => p.participantId === 'c')?.placement).toBe(3);
    expect(payload.participants.find((p) => p.participantId === 'd')?.placement).toBe(4);
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
