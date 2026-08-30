import { resolveCombatEnd } from './brawler-combat-end.util';
import { createEmptyCombatState, secondsToTicks } from './brawler-combat.types';
import type { BrawlerCombatFighterV1 } from './brawler-combat.types';
import { DEFAULT_MELEE_DAMAGE } from './brawler-combat.constants';
import { applyForfeitsToState } from './brawler-combat-forfeit.util';

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

describe('resolveCombatEnd', () => {
  const nowMs = Date.now();
  const base = createEmptyCombatState({
    sessionId: 's1',
    startedAtMs: nowMs,
    endsAtMs: nowMs + 60_000,
    fighters: [],
  });

  it('ends with one human winner when two humans and one forfeits', () => {
    const fighters = [
      fighter({ participantId: 'h1', playerId: 'p1', alive: false, hp: 0 }),
      fighter({ participantId: 'h2', playerId: 'p2' }),
    ];
    const end = resolveCombatEnd(base, fighters, { preferEndReason: 'FORFEIT' });
    expect(end.status).toBe('ENDED');
    expect(end.winnerParticipantId).toBe('h2');
    expect(end.endReason).toBe('FORFEIT');
  });

  it('continues when two humans remain alive', () => {
    const fighters = [
      fighter({ participantId: 'h1', playerId: 'p1' }),
      fighter({ participantId: 'h2', playerId: 'p2' }),
    ];
    const end = resolveCombatEnd(base, fighters);
    expect(end.status).toBe('ACTIVE');
  });
});

describe('applyForfeitsToState', () => {
  const nowMs = Date.now();

  it('marks fighter forfeited and ends 2p match', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: nowMs,
      endsAtMs: nowMs + 60_000,
      fighters: [
        fighter({ participantId: 'h1', playerId: 'p1' }),
        fighter({ participantId: 'h2', playerId: 'p2' }),
      ],
    });
    const next = applyForfeitsToState(state, ['h1']);
    expect(next.status).toBe('ENDED');
    expect(next.endReason).toBe('FORFEIT');
    expect(next.winnerParticipantId).toBe('h2');
    const f1 = next.fighters.find((f) => f.participantId === 'h1');
    expect(f1?.alive).toBe(false);
    expect(f1?.forfeited).toBe(true);
  });

  it('keeps match active when two humans still alive in 4p', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: nowMs,
      endsAtMs: nowMs + 60_000,
      fighters: [
        fighter({ participantId: 'h1', playerId: 'p1' }),
        fighter({ participantId: 'h2', playerId: 'p2' }),
        fighter({ participantId: 'h3', playerId: 'p3' }),
        fighter({ participantId: 'h4', playerId: 'p4' }),
      ],
    });
    const next = applyForfeitsToState(state, ['h1']);
    expect(next.status).toBe('ACTIVE');
    expect(next.fighters.find((f) => f.participantId === 'h1')?.forfeited).toBe(true);
  });

  it('ends 4p when one human remains after three forfeits', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: nowMs,
      endsAtMs: nowMs + 60_000,
      fighters: [
        fighter({ participantId: 'h1', playerId: 'p1', alive: false, hp: 0, forfeited: true }),
        fighter({ participantId: 'h2', playerId: 'p2', alive: false, hp: 0, forfeited: true }),
        fighter({ participantId: 'h3', playerId: 'p3' }),
        fighter({ participantId: 'h4', playerId: 'p4', alive: false, hp: 0, forfeited: true }),
      ],
    });
    const next = applyForfeitsToState(state, ['h4']);
    expect(next.status).toBe('ENDED');
    expect(next.winnerParticipantId).toBe('h3');
    expect(next.endReason).toBe('FORFEIT');
  });
});
