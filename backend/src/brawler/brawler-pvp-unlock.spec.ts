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
    x: 200,
    y: 800,
    prevY: 800,
    vx: 0,
    vy: 0,
    facing: 1,
    hp: partial.hp ?? 100,
    maxHp: 100,
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

describe('two-human combat finalize agreement', () => {
  it('buildFinalizeFromCombat agrees on winner for two humans', () => {
    const state = createEmptyCombatState({
      sessionId: 's-pvp',
      startedAtMs: 0,
      endsAtMs: 1,
      fighters: [
        fighter({
          participantId: 'human-a',
          playerId: 'p-a',
          hp: 20,
          kills: 1,
        }),
        fighter({
          participantId: 'human-b',
          playerId: 'p-b',
          hp: 0,
          alive: false,
          deaths: 1,
        }),
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
