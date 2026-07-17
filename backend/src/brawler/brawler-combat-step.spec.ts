import { stepCombat, type BrawlerCombatInputV1 } from './brawler-combat-step';
import { createEmptyCombatState } from './brawler-combat.types';

function baseFighters() {
  return [
    {
      participantId: 'human',
      playerId: 'pl1',
      isBot: false,
      x: 0.3,
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
    {
      participantId: 'bot',
      playerId: null,
      isBot: true,
      x: 0.7,
      y: 0.8,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: 100,
      maxHp: 100,
      alive: true,
      kills: 0,
      deaths: 0,
      cooldowns: {},
      buffs: [],
    },
  ];
}

describe('stepCombat', () => {
  it('moves a fighter from input and increments tick', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      fighters: baseFighters(),
    });
    const inputs: BrawlerCombatInputV1[] = [
      { participantId: 'human', seq: 1, moveX: 1, moveY: 0 },
    ];
    const next = stepCombat(state, inputs, 1000);
    expect(next.tick).toBe(1);
    expect(next.fighters.find((f) => f.participantId === 'human')!.x).toBeGreaterThan(
      0.3,
    );
    expect(next.rev).toBe(0);
  });

  it('applies bot AI toward the human when no bot input', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      fighters: baseFighters(),
    });
    const next = stepCombat(state, [], 1000);
    const bot = next.fighters.find((f) => f.participantId === 'bot')!;
    expect(bot.x).toBeLessThan(0.7);
  });

  it('ends on time with highest kills as winner', () => {
    const fighters = baseFighters();
    fighters[0].kills = 2;
    fighters[1].kills = 5;
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1000,
      fighters,
    });
    const next = stepCombat(state, [], 2000);
    expect(next.status).toBe('ENDED');
    expect(next.endReason).toBe('TIME');
    expect(next.winnerParticipantId).toBe('bot');
  });

  it('ends on KO when one fighter remains', () => {
    const fighters = baseFighters();
    fighters[1].alive = false;
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      fighters,
    });
    const next = stepCombat(state, [], 1000);
    expect(next.status).toBe('ENDED');
    expect(next.endReason).toBe('KO');
    expect(next.winnerParticipantId).toBe('human');
  });

  it('applies melee damage on fire when in range', () => {
    const fighters = baseFighters();
    fighters[0].x = 0.5;
    fighters[1].x = 0.55;
    fighters[1].y = 0.8;
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      fighters,
    });
    const next = stepCombat(
      state,
      [{ participantId: 'human', seq: 1, moveX: 0, moveY: 0, fire: true }],
      1000,
    );
    const bot = next.fighters.find((f) => f.participantId === 'bot')!;
    expect(bot.hp).toBeLessThan(100);
  });

  it('registers a KO kill after enough melee hits', () => {
    const fighters = baseFighters();
    fighters[0].x = 0.5;
    fighters[1].x = 0.52;
    fighters[1].hp = 10;
    fighters[1].maxHp = 100;
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      fighters,
    });
    const next = stepCombat(
      state,
      [{ participantId: 'human', seq: 1, moveX: 0, moveY: 0, fire: true }],
      1000,
    );
    expect(next.status).toBe('ENDED');
    expect(next.endReason).toBe('KO');
    expect(next.winnerParticipantId).toBe('human');
    expect(next.fighters.find((f) => f.participantId === 'human')!.kills).toBe(1);
    expect(next.fighters.find((f) => f.participantId === 'bot')!.deaths).toBe(1);
  });
});
