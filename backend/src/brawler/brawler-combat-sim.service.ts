import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import {
  BRAWLER_COMBAT_LOCK_TTL_MS,
  BRAWLER_COMBAT_TICK_MS,
  type BrawlerCombatLiveStateV1,
} from './brawler-combat.types';
import {
  stepCombat,
  type BrawlerCombatInputV1,
} from './brawler-combat-step';
import { BrawlerCombatRedisService } from './brawler-combat-redis.service';
import {
  BRAWLER_COMBAT_EVENT,
  BRAWLER_COMBAT_ENDED_EVENT,
  type BrawlerCombatSocketPayload,
} from './brawler-combat.events';
import { BrawlerService } from './brawler.service';

const MAX_INPUTS_PER_SEC = 40;

@Injectable()
export class BrawlerCombatSimService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BrawlerCombatSimService.name);
  private readonly ownerToken = randomUUID();
  private readonly activeSessions = new Set<string>();
  private readonly mailbox = new Map<string, Map<string, BrawlerCombatInputV1>>();
  private readonly inputRate = new Map<string, { windowStartMs: number; count: number }>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly combat: BrawlerCombatRedisService,
    private readonly events: EventEmitter2,
    @Inject(forwardRef(() => BrawlerService))
    private readonly brawler: BrawlerService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tickAll();
    }, BRAWLER_COMBAT_TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  registerSession(sessionId: string): void {
    this.activeSessions.add(sessionId);
  }

  unregisterSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.mailbox.delete(sessionId);
  }

  clearParticipantInput(sessionId: string, participantId: string): void {
    this.mailbox.get(sessionId)?.delete(participantId);
  }

  enqueueInput(sessionId: string, input: BrawlerCombatInputV1): boolean {
    const rateKey = `${sessionId}:${input.participantId}`;
    const now = Date.now();
    const bucket = this.inputRate.get(rateKey);
    if (!bucket || now - bucket.windowStartMs >= 1000) {
      this.inputRate.set(rateKey, { windowStartMs: now, count: 1 });
    } else if (bucket.count >= MAX_INPUTS_PER_SEC) {
      return false;
    } else {
      bucket.count += 1;
    }

    let byParticipant = this.mailbox.get(sessionId);
    if (!byParticipant) {
      byParticipant = new Map();
      this.mailbox.set(sessionId, byParticipant);
    }
    const prev = byParticipant.get(input.participantId);
    if (prev && input.seq < prev.seq) return true;
    byParticipant.set(input.participantId, {
      ...input,
      moveX: clamp(input.moveX, -1, 1),
      moveY: clamp(input.moveY, -1, 1),
    });
    this.activeSessions.add(sessionId);
    return true;
  }

  private drainInputs(sessionId: string): BrawlerCombatInputV1[] {
    const byParticipant = this.mailbox.get(sessionId);
    if (!byParticipant) return [];
    const inputs = [...byParticipant.values()];
    byParticipant.clear();
    return inputs;
  }

  private emitSnapshot(state: BrawlerCombatLiveStateV1): void {
    const payload: BrawlerCombatSocketPayload = {
      sessionId: state.sessionId,
      type: 'snapshot',
      state,
    };
    this.events.emit(BRAWLER_COMBAT_EVENT, payload);
  }

  private async applyIdleForfeits(
    sessionId: string,
    state: BrawlerCombatLiveStateV1,
    nowMs: number,
  ): Promise<BrawlerCombatLiveStateV1> {
    const idleMs = this.brawler.forfeitIdleMs();
    const presence = await this.combat.readPresence(sessionId);
    const stale: string[] = [];
    for (const f of state.fighters) {
      if (!f.alive || f.isBot) continue;
      const last = presence[f.participantId];
      if (last == null) continue;
      if (nowMs - last >= idleMs) {
        stale.push(f.participantId);
      }
    }
    if (stale.length === 0) return state;
    const next = await this.brawler.applyCombatForfeits(sessionId, stale);
    return next ?? state;
  }

  async tickSession(sessionId: string): Promise<void> {
    const acquired = await this.combat.tryAcquireTickLock(
      sessionId,
      this.ownerToken,
      BRAWLER_COMBAT_LOCK_TTL_MS,
    );
    if (!acquired) {
      const renewed = await this.combat.renewTickLock(
        sessionId,
        this.ownerToken,
        BRAWLER_COMBAT_LOCK_TTL_MS,
      );
      if (!renewed) return;
    } else {
      await this.combat.renewTickLock(
        sessionId,
        this.ownerToken,
        BRAWLER_COMBAT_LOCK_TTL_MS,
      );
    }

    let current = await this.combat.readState(sessionId);
    if (!current || current.status !== 'ACTIVE') {
      this.unregisterSession(sessionId);
      return;
    }

    const nowMs = Date.now();
    current = await this.applyIdleForfeits(sessionId, current, nowMs);
    if (current.status !== 'ACTIVE') {
      this.unregisterSession(sessionId);
      await this.combat.releaseTickLock(sessionId, this.ownerToken);
      return;
    }

    const inputs = this.drainInputs(sessionId);
    const stepped = stepCombat(current, inputs, nowMs);
    const written = await this.combat.writeState(stepped);
    this.emitSnapshot(written);

    if (written.status === 'ENDED') {
      this.unregisterSession(sessionId);
      await this.combat.releaseTickLock(sessionId, this.ownerToken);
      this.events.emit(BRAWLER_COMBAT_ENDED_EVENT, {
        sessionId,
        state: written,
      });
    }
  }

  private async tickAll(): Promise<void> {
    const ids = [...this.activeSessions];
    for (const sessionId of ids) {
      try {
        await this.tickSession(sessionId);
      } catch (e) {
        this.log.warn(`tick ${sessionId}: ${(e as Error).message}`);
      }
    }
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
