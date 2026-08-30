import {
  ATTACK_DURATION_S,
  ATTACK_HIT_FORWARD,
  ATTACK_HIT_H,
  ATTACK_HIT_W,
  ATTACK_HIT_Y_FROM_TOP,
  ATTACK_MOVE_SPEED_MUL,
  BASE_MOVE_SPEED_PX,
  DASH_DURATION_S,
  DASH_SPEED,
  DEFAULT_MELEE_DAMAGE,
  DOUBLE_JUMP_VELOCITY_MUL,
  FIGHTER_BODY_H,
  FIGHTER_BODY_W,
  FIGHTER_FEET_W,
  GRAVITY,
  HERO_IFRAMES_S,
  JUMP_VELOCITY,
  MAX_AIR_JUMPS,
  MELEE_COOLDOWN_S,
  MOVE_ACCEL,
  MOVE_ACCEL_ATTACK,
  MOVE_DECEL,
  MOVE_DECEL_ATTACK,
  MARGIN_SCREEN,
} from './brawler-combat.constants';
import {
  buildArenaPlatforms,
  type PlatformWorld,
} from './brawler-arena-platforms.util';
import { applyCombatEndToState } from './brawler-combat-end.util';
import {
  BRAWLER_COMBAT_TICK_MS,
  secondsToTicks,
  type BrawlerCombatFighterV1,
} from './brawler-combat.types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function overlapX(
  ax: number,
  aw: number,
  p: Pick<PlatformWorld, 'x' | 'w'>,
  inset = 4,
): boolean {
  return ax + aw > p.x + inset && ax < p.x + p.w - inset;
}

function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export type BrawlerCombatInputV1 = {
  participantId: string;
  seq: number;
  moveX: number;
  moveY: number;
  jump?: boolean;
  dash?: boolean;
  fire?: boolean;
  pickup?: boolean;
};

function cloneFighter(f: BrawlerCombatFighterV1): BrawlerCombatFighterV1 {
  return {
    ...f,
    buffs: [...f.buffs],
    cooldowns: { ...f.cooldowns },
  };
}

function applyBotAi(
  fighters: BrawlerCombatFighterV1[],
  inputsByParticipant: Map<string, BrawlerCombatInputV1>,
  tick: number,
  worldW: number,
  worldH: number,
): void {
  const humans = fighters.filter((f) => f.alive && !f.isBot);
  for (const bot of fighters) {
    if (!bot.alive || !bot.isBot) continue;
    if (inputsByParticipant.has(bot.participantId)) continue;

    let target = humans[0];
    let bestDist = Infinity;
    for (const h of humans) {
      const d = Math.hypot(h.x - bot.x, h.y - bot.y);
      if (d < bestDist) {
        bestDist = d;
        target = h;
      }
    }

    if (!target) {
      inputsByParticipant.set(bot.participantId, {
        participantId: bot.participantId,
        seq: tick,
        moveX: 0,
        moveY: 0,
      });
      continue;
    }

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const mag = Math.hypot(dx, dy) || 1;
    const meleeRange = ATTACK_HIT_W + ATTACK_HIT_FORWARD + FIGHTER_BODY_W;
    inputsByParticipant.set(bot.participantId, {
      participantId: bot.participantId,
      seq: tick,
      moveX: clamp(dx / mag, -1, 1),
      moveY: 0,
      fire: mag < meleeRange,
      jump: bot.onGround && target.y + 20 < bot.y && Math.random() < 0.02,
    });
  }
}

function tickFighterPhysics(
  f: BrawlerCombatFighterV1,
  input: BrawlerCombatInputV1 | undefined,
  plats: PlatformWorld[],
  worldW: number,
  worldH: number,
  dt: number,
): BrawlerCombatFighterV1 {
  if (!f.alive) return f;

  const next = cloneFighter(f);
  const bodyW = FIGHTER_BODY_W;
  const bodyH = FIGHTER_BODY_H;
  const feetW = FIGHTER_FEET_W;

  next.iFramesLeftTicks = Math.max(0, next.iFramesLeftTicks - 1);
  next.dashCooldownLeftTicks = Math.max(0, next.dashCooldownLeftTicks - 1);
  next.attackTimeLeftTicks = Math.max(0, next.attackTimeLeftTicks - 1);

  const wasDashing = next.dashTimeLeftTicks > 0;
  next.dashTimeLeftTicks = Math.max(0, next.dashTimeLeftTicks - 1);
  if (wasDashing && next.dashTimeLeftTicks <= 0) {
    next.dashCooldownLeftTicks = next.dashCooldownTicks;
  }

  const attacking = next.attackTimeLeftTicks > 0;
  const dashing = next.dashTimeLeftTicks > 0;

  if (input?.fire && next.meleeReadyTick <= 0 && next.attackTimeLeftTicks <= 0) {
    next.attackTimeLeftTicks = secondsToTicks(ATTACK_DURATION_S);
  }

  if (input?.dash && next.dashTimeLeftTicks <= 0 && next.dashCooldownLeftTicks <= 0) {
    next.dashTimeLeftTicks = secondsToTicks(DASH_DURATION_S);
    next.dashCooldownLeftTicks = next.dashCooldownTicks;
  }

  if (input?.jump) {
    if (next.onGround) {
      next.vy = JUMP_VELOCITY;
      next.onGround = false;
    } else if (next.airJumpsLeft > 0) {
      next.vy = JUMP_VELOCITY * DOUBLE_JUMP_VELOCITY_MUL;
      next.airJumpsLeft -= 1;
    }
  }

  const moveX = input?.moveX ?? 0;
  if (dashing) {
    const dir = next.facing >= 0 ? 1 : -1;
    next.vx = dir * DASH_SPEED;
  } else {
    const moveMul = attacking ? ATTACK_MOVE_SPEED_MUL : 1;
    const accel = attacking ? MOVE_ACCEL_ATTACK : MOVE_ACCEL;
    const decel = attacking ? MOVE_DECEL_ATTACK : MOVE_DECEL;
    const targetVx =
      moveX * BASE_MOVE_SPEED_PX * next.moveSpeedMul * moveMul;
    if (Math.abs(moveX) > 0.02) {
      next.facing = moveX >= 0 ? 1 : -1;
      next.vx += (targetVx - next.vx) * Math.min(1, dt * accel);
    } else {
      next.vx *= Math.pow(0.2, dt * decel);
      if (Math.abs(next.vx) < 4) next.vx = 0;
    }
  }

  next.x += next.vx * dt;
  next.x = clamp(next.x, MARGIN_SCREEN, worldW - MARGIN_SCREEN - bodyW);

  next.prevY = next.y;
  next.vy += GRAVITY * dt;
  next.y += next.vy * dt;

  const feetX = next.x + (bodyW - feetW) / 2;
  const prevBottom = next.prevY + bodyH;
  let newBottom = next.y + bodyH;

  if (next.vy > 0) {
    let best: PlatformWorld | null = null;
    for (const p of plats) {
      if (!overlapX(feetX, feetW, p)) continue;
      const pt = p.y;
      if (prevBottom <= pt + 14 && newBottom >= pt - 6) {
        if (!best || pt < best.y) best = p;
      }
    }
    if (best) {
      next.y = best.y - bodyH + best.feetEmbedPx;
      next.vy = 0;
      next.onGround = true;
      newBottom = best.y + best.feetEmbedPx;
    }
  }

  if (next.vy >= 0) {
    newBottom = next.y + bodyH;
    for (const p of plats) {
      if (!overlapX(feetX, feetW, p)) continue;
      const pt = p.y;
      if (newBottom >= pt - 2 && newBottom <= pt + 18) {
        next.y = pt - bodyH + p.feetEmbedPx;
        next.vy = 0;
        next.onGround = true;
        break;
      }
    }
  }

  if (next.onGround) {
    next.airJumpsLeft = MAX_AIR_JUMPS;
  }

  if (next.y > worldH + 120) {
    next.alive = false;
    next.deaths += 1;
    next.hp = 0;
  }

  return next;
}

function applyMelee(
  fighters: BrawlerCombatFighterV1[],
  tick: number,
): BrawlerCombatFighterV1[] {
  const next = fighters.map(cloneFighter);
  const iFrameTicks = secondsToTicks(HERO_IFRAMES_S);
  const meleeCooldownTicks = secondsToTicks(MELEE_COOLDOWN_S);

  for (let i = 0; i < next.length; i++) {
    const attacker = next[i]!;
    if (!attacker.alive || attacker.attackTimeLeftTicks <= 0) continue;
    if (tick < attacker.meleeReadyTick) continue;

    const dir = attacker.facing >= 0 ? 1 : -1;
    const hitW = ATTACK_HIT_W;
    const hitH = ATTACK_HIT_H;
    const hitY = attacker.y + ATTACK_HIT_Y_FROM_TOP;
    const hitX =
      dir > 0
        ? attacker.x + FIGHTER_BODY_W + ATTACK_HIT_FORWARD
        : attacker.x - hitW - ATTACK_HIT_FORWARD;

    for (let j = 0; j < next.length; j++) {
      if (i === j) continue;
      const target = next[j]!;
      if (!target.alive || target.iFramesLeftTicks > 0) continue;
      if (
        !aabbOverlap(
          hitX,
          hitY,
          hitW,
          hitH,
          target.x,
          target.y,
          FIGHTER_BODY_W,
          FIGHTER_BODY_H,
        )
      ) {
        continue;
      }

      attacker.meleeReadyTick = tick + meleeCooldownTicks;
      const dmg = Math.max(1, attacker.attackDamage);
      target.hp = Math.max(0, target.hp - dmg);
      target.iFramesLeftTicks = iFrameTicks;
      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        target.deaths += 1;
        attacker.kills += 1;
      }
      break;
    }
  }

  return next;
}

export function stepCombat(
  state: import('./brawler-combat.types').BrawlerCombatLiveStateV1,
  inputs: BrawlerCombatInputV1[],
  nowMs: number = Date.now(),
): import('./brawler-combat.types').BrawlerCombatLiveStateV1 {
  if (state.status !== 'ACTIVE') return state;

  const dt = BRAWLER_COMBAT_TICK_MS / 1000;
  const worldW = state.world.w;
  const worldH = state.world.h;
  const plats = buildArenaPlatforms(worldW, worldH);

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

  const nextTick = state.tick + 1;
  applyBotAi(state.fighters, inputsByParticipant, nextTick, worldW, worldH);

  let fighters = state.fighters.map((f) =>
    tickFighterPhysics(
      f,
      inputsByParticipant.get(f.participantId),
      plats,
      worldW,
      worldH,
      dt,
    ),
  );

  fighters = applyMelee(fighters, nextTick);

  const ended = applyCombatEndToState(
    {
      ...state,
      tick: nextTick,
      fighters,
      projectiles: [...state.projectiles],
      world: { ...state.world },
    },
    fighters,
    { nowMs, preferEndReason: 'KO' },
  );

  return {
    ...ended,
    tick: nextTick,
  };
}

export function combatNeedsTick(
  state: import('./brawler-combat.types').BrawlerCombatLiveStateV1 | null,
): boolean {
  return state?.status === 'ACTIVE';
}

export function aliveFighters(
  state: import('./brawler-combat.types').BrawlerCombatLiveStateV1,
) {
  return state.fighters.filter((f) => f.alive);
}
