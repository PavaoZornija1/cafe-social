import {
  BRAWLER_COMBAT_TICK_MS,
  type BrawlerCombatEndReason,
  type BrawlerCombatFighterV1,
  type BrawlerCombatLiveStateV1,
  type BrawlerCombatStatus,
} from './brawler-combat.types';

export type BrawlerCombatInputV1 = {
  participantId: string;
  seq: number;
  /** Stick X in [-1, 1]. */
  moveX: number;
  /** Stick Y in [-1, 1] (positive = down in screen space). */
  moveY: number;
  fire?: boolean;
  pickup?: boolean;
};

const MOVE_SPEED = 0.35; // normalized units / second
const MELEE_RANGE = 0.11;
const MELEE_DAMAGE = 12;
const MELEE_COOLDOWN_TICKS = 8; // 0.4s at 20 Hz

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function aliveFighters(state: BrawlerCombatLiveStateV1) {
  return state.fighters.filter((f) => f.alive);
}

function applyBotAi(
  state: BrawlerCombatLiveStateV1,
  inputsByParticipant: Map<string, BrawlerCombatInputV1>,
): void {
  const humans = state.fighters.filter((f) => f.alive && !f.isBot);
  for (const bot of state.fighters) {
    if (!bot.alive || !bot.isBot) continue;
    if (inputsByParticipant.has(bot.participantId)) continue;
    const target = humans[0];
    if (!target) {
      inputsByParticipant.set(bot.participantId, {
        participantId: bot.participantId,
        seq: state.tick,
        moveX: 0,
        moveY: 0,
      });
      continue;
    }
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const mag = Math.hypot(dx, dy) || 1;
    inputsByParticipant.set(bot.participantId, {
      participantId: bot.participantId,
      seq: state.tick,
      moveX: clamp(dx / mag, -1, 1),
      moveY: clamp(dy / mag, -1, 1),
      fire: mag < MELEE_RANGE,
    });
  }
}

function applyMelee(
  fighters: BrawlerCombatFighterV1[],
  inputsByParticipant: Map<string, BrawlerCombatInputV1>,
  tick: number,
): BrawlerCombatFighterV1[] {
  const next = fighters.map((f) => ({
    ...f,
    buffs: [...f.buffs],
    cooldowns: { ...f.cooldowns },
  }));

  for (let i = 0; i < next.length; i++) {
    const attacker = next[i]!;
    if (!attacker.alive) continue;
    const input = inputsByParticipant.get(attacker.participantId);
    if (!input?.fire) continue;
    const readyAt = attacker.cooldowns.meleeReadyTick ?? 0;
    if (tick < readyAt) continue;

    let bestIdx = -1;
    let bestDist = MELEE_RANGE;
    for (let j = 0; j < next.length; j++) {
      if (i === j) continue;
      const target = next[j]!;
      if (!target.alive) continue;
      const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y);
      if (dist <= bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    if (bestIdx < 0) continue;

    attacker.cooldowns.meleeReadyTick = tick + MELEE_COOLDOWN_TICKS;
    const target = next[bestIdx]!;
    const hp = Math.max(0, target.hp - MELEE_DAMAGE);
    target.hp = hp;
    if (hp <= 0 && target.alive) {
      target.alive = false;
      target.deaths += 1;
      attacker.kills += 1;
    }
  }

  return next;
}

/**
 * Advance combat by one fixed tick. Pure: returns a new state object (same `rev`).
 * Caller is responsible for CAS write / rev bump.
 */
export function stepCombat(
  state: BrawlerCombatLiveStateV1,
  inputs: BrawlerCombatInputV1[],
  nowMs: number = Date.now(),
): BrawlerCombatLiveStateV1 {
  if (state.status !== 'ACTIVE') return state;

  const dt = BRAWLER_COMBAT_TICK_MS / 1000;
  const inputsByParticipant = new Map<string, BrawlerCombatInputV1>();
  for (const input of inputs) {
    const prev = inputsByParticipant.get(input.participantId);
    if (!prev || input.seq >= prev.seq) {
      inputsByParticipant.set(input.participantId, {
        ...input,
        moveX: clamp(input.moveX, -1, 1),
        moveY: clamp(input.moveY, -1, 1),
      });
    }
  }
  applyBotAi(state, inputsByParticipant);

  let fighters = state.fighters.map((f) => {
    if (!f.alive) return { ...f, buffs: [...f.buffs], cooldowns: { ...f.cooldowns } };
    const input = inputsByParticipant.get(f.participantId);
    const moveX = input?.moveX ?? 0;
    const moveY = input?.moveY ?? 0;
    const facing = moveX === 0 ? f.facing : moveX > 0 ? 1 : -1;
    return {
      ...f,
      x: clamp(f.x + moveX * MOVE_SPEED * dt, 0, 1),
      y: clamp(f.y + moveY * MOVE_SPEED * dt, 0, 1),
      vx: moveX * MOVE_SPEED,
      vy: moveY * MOVE_SPEED,
      facing,
      buffs: [...f.buffs],
      cooldowns: { ...f.cooldowns },
    };
  });

  const nextTick = state.tick + 1;
  fighters = applyMelee(fighters, inputsByParticipant, nextTick);

  let status: BrawlerCombatStatus = state.status;
  let winnerParticipantId = state.winnerParticipantId ?? null;
  let endReason: BrawlerCombatEndReason | undefined = state.endReason;

  const living = fighters.filter((f) => f.alive);
  if (living.length <= 1) {
    status = 'ENDED';
    winnerParticipantId = living[0]?.participantId ?? null;
    endReason = 'KO';
  } else if (nowMs >= state.endsAtMs) {
    status = 'ENDED';
    endReason = 'TIME';
    const ranked = [...fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    winnerParticipantId = ranked[0]?.participantId ?? null;
  }

  return {
    ...state,
    tick: nextTick,
    status,
    fighters,
    projectiles: [...state.projectiles],
    world: { ...state.world },
    winnerParticipantId,
    endReason,
  };
}

export function combatNeedsTick(state: BrawlerCombatLiveStateV1 | null): boolean {
  return state?.status === 'ACTIVE';
}

export { aliveFighters };
