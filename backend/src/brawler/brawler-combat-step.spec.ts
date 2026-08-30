import { stepCombat, type BrawlerCombatInputV1 } from './brawler-combat-step';
import {
  combatWorldFromRef,
  DEFAULT_MELEE_DAMAGE,
  REF_WORLD_W,
} from './brawler-combat.constants';
import { createEmptyCombatState, secondsToTicks } from './brawler-combat.types';
import type { BrawlerCombatFighterV1 } from './brawler-combat.types';
import { spawnFightersOnBottomPlatform } from './brawler-arena-platforms.util';

function makeFighter(
  partial: Partial<BrawlerCombatFighterV1> & Pick<BrawlerCombatFighterV1, 'participantId'>,
): BrawlerCombatFighterV1 {
  const spawns = spawnFightersOnBottomPlatform(2, REF_WORLD_W, combatWorldFromRef().h);
  const spawn = spawns[0]!;
  return {
    playerId: partial.playerId ?? null,
    isBot: partial.isBot ?? false,
    x: partial.x ?? spawn.x,
    y: partial.y ?? spawn.y,
    prevY: partial.prevY ?? spawn.y,
    vx: 0,
    vy: 0,
    facing: partial.facing ?? 1,
    hp: partial.hp ?? 100,
    maxHp: partial.maxHp ?? 100,
    alive: partial.alive ?? true,
    kills: partial.kills ?? 0,
    deaths: partial.deaths ?? 0,
    onGround: partial.onGround ?? true,
    airJumpsLeft: partial.airJumpsLeft ?? 1,
    iFramesLeftTicks: partial.iFramesLeftTicks ?? 0,
    meleeReadyTick: partial.meleeReadyTick ?? 0,
    dashTimeLeftTicks: 0,
    dashCooldownLeftTicks: 0,
    attackTimeLeftTicks: partial.attackTimeLeftTicks ?? 0,
    moveSpeedMul: 1,
    attackDamage: partial.attackDamage ?? DEFAULT_MELEE_DAMAGE,
    dashCooldownTicks: secondsToTicks(2.2),
    cooldowns: {},
    buffs: [],
    ...partial,
  };
}

function baseFighters(): BrawlerCombatFighterV1[] {
  const spawns = spawnFightersOnBottomPlatform(2, REF_WORLD_W, combatWorldFromRef().h);
  return [
    makeFighter({
      participantId: 'human',
      playerId: 'pl1',
      isBot: false,
      x: spawns[0]!.x,
      y: spawns[0]!.y,
    }),
    makeFighter({
      participantId: 'bot',
      playerId: null,
      isBot: true,
      x: spawns[1]!.x,
      y: spawns[1]!.y,
      facing: -1,
    }),
  ];
}

describe('stepCombat', () => {
  it('moves a fighter from input and increments tick', () => {
    const world = combatWorldFromRef();
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      world,
      fighters: baseFighters(),
    });
    const inputs: BrawlerCombatInputV1[] = [
      { participantId: 'human', seq: 1, moveX: 1, moveY: 0 },
    ];
    const next = stepCombat(state, inputs, 1000);
    expect(next.tick).toBe(1);
    const human = next.fighters.find((f) => f.participantId === 'human')!;
    expect(human.x).toBeGreaterThan(baseFighters()[0]!.x);
    expect(next.rev).toBe(0);
  });

  it('applies bot AI toward the nearest human when no bot input', () => {
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      world: combatWorldFromRef(),
      fighters: baseFighters(),
    });
    const next = stepCombat(state, [], 1000);
    const bot = next.fighters.find((f) => f.participantId === 'bot')!;
    expect(bot.x).not.toBe(baseFighters()[1]!.x);
  });

  it('ends on time with highest kills as winner', () => {
    const fighters = baseFighters();
    fighters[0]!.kills = 2;
    fighters[1]!.kills = 5;
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 1000,
      world: combatWorldFromRef(),
      fighters,
    });
    const next = stepCombat(state, [], 2000);
    expect(next.status).toBe('ENDED');
    expect(next.endReason).toBe('TIME');
    expect(next.winnerParticipantId).toBe('bot');
  });

  it('ends on KO when one fighter remains', () => {
    const fighters = baseFighters();
    fighters[1]!.alive = false;
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      world: combatWorldFromRef(),
      fighters,
    });
    const next = stepCombat(state, [], 1000);
    expect(next.status).toBe('ENDED');
    expect(next.endReason).toBe('KO');
    expect(next.winnerParticipantId).toBe('human');
  });

  it('applies melee damage on fire when in range', () => {
    const fighters = baseFighters();
    fighters[0]!.x = fighters[1]!.x - 40;
    fighters[0]!.y = fighters[1]!.y;
    fighters[0]!.facing = 1;
    fighters[0]!.attackTimeLeftTicks = secondsToTicks(0.28);
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      world: combatWorldFromRef(),
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
    fighters[0]!.x = fighters[1]!.x - 40;
    fighters[0]!.y = fighters[1]!.y;
    fighters[0]!.facing = 1;
    fighters[1]!.hp = 10;
    fighters[0]!.attackTimeLeftTicks = secondsToTicks(0.28);
    const state = createEmptyCombatState({
      sessionId: 's1',
      startedAtMs: 0,
      endsAtMs: 60_000,
      world: combatWorldFromRef(),
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
