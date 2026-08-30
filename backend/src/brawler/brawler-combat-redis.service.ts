import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GameRuntimeRedisService } from '../redis/game-runtime-redis.service';
import {
  allowMemoryGameRuntime,
  type GameRuntimeEnv,
} from '../redis/game-runtime-policy';
import {
  BRAWLER_COMBAT_STATE_VERSION,
  createEmptyCombatState,
  type BrawlerCombatLiveStateV1,
  type CreateCombatStateInput,
} from './brawler-combat.types';

const STATE_KEY_PREFIX = 'v1:gm:brawler:combat:';
const PRESENCE_KEY_PREFIX = 'v1:gm:brawler:combat:presence:';
const LOCK_KEY_PREFIX = 'v1:gm:brawler:combat:lock:';
const STATE_TTL_SEC = 172800;
const CAS_MAX_ATTEMPTS = 8;

@Injectable()
export class BrawlerCombatRedisService {
  private readonly log = new Logger(BrawlerCombatRedisService.name);
  private readonly memory = new Map<string, BrawlerCombatLiveStateV1>();
  private readonly memoryPresence = new Map<string, Record<string, number>>();
  private readonly memoryAllowed: boolean;

  constructor(
    private readonly redis: GameRuntimeRedisService,
    private readonly config: ConfigService,
  ) {
    this.memoryAllowed = allowMemoryGameRuntime(this.envSnapshot());
  }

  private envSnapshot(): GameRuntimeEnv {
    return {
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      REDIS_URL: this.config.get<string>('REDIS_URL'),
      GAME_RUNTIME_REQUIRE_REDIS: this.config.get<string>(
        'GAME_RUNTIME_REQUIRE_REDIS',
      ),
      GAME_RUNTIME_ALLOW_MEMORY: this.config.get<string>(
        'GAME_RUNTIME_ALLOW_MEMORY',
      ),
    };
  }

  private stateKey(sessionId: string): string {
    return `${STATE_KEY_PREFIX}${sessionId}`;
  }

  private lockKey(sessionId: string): string {
    return `${LOCK_KEY_PREFIX}${sessionId}`;
  }

  private presenceKey(sessionId: string): string {
    return `${PRESENCE_KEY_PREFIX}${sessionId}`;
  }

  private unavailable(message: string): ServiceUnavailableException {
    return new ServiceUnavailableException({
      statusCode: 503,
      error: 'Service Unavailable',
      message,
    });
  }

  private assertMemoryFallbackAllowed(op: string): void {
    if (this.memoryAllowed) return;
    throw this.unavailable(
      `Brawler combat ${op} unavailable: Redis game runtime is required (set REDIS_URL, or GAME_RUNTIME_ALLOW_MEMORY=1 for local single-process only)`,
    );
  }

  private parse(
    raw: string,
    sessionId: string,
  ): BrawlerCombatLiveStateV1 | null {
    try {
      const parsed = JSON.parse(raw) as BrawlerCombatLiveStateV1;
      if (
        parsed?.v !== BRAWLER_COMBAT_STATE_VERSION ||
        parsed.sessionId !== sessionId ||
        !Array.isArray(parsed.fighters) ||
        !Array.isArray(parsed.projectiles) ||
        typeof parsed.tick !== 'number' ||
        typeof parsed.world?.w !== 'number' ||
        typeof parsed.world?.h !== 'number'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async readState(sessionId: string): Promise<BrawlerCombatLiveStateV1 | null> {
    if (this.redis.isEnabled()) {
      try {
        const raw = await this.redis.get(this.stateKey(sessionId));
        if (!raw) return null;
        return this.parse(raw, sessionId);
      } catch (e) {
        this.log.warn(`readState ${sessionId}: ${(e as Error).message}`);
        throw this.unavailable(
          `Brawler combat read failed: ${(e as Error).message}`,
        );
      }
    }
    this.assertMemoryFallbackAllowed('read');
    return this.memory.get(sessionId) ?? null;
  }

  async writeState(
    state: BrawlerCombatLiveStateV1,
  ): Promise<BrawlerCombatLiveStateV1> {
    const expectedRev = state.rev;
    const next: BrawlerCombatLiveStateV1 = { ...state, rev: state.rev + 1 };

    if (this.redis.isEnabled()) {
      try {
        const ok = await this.redis.compareAndSetJsonRev({
          key: this.stateKey(state.sessionId),
          expectedRev,
          nextValue: JSON.stringify(next),
          ttlSeconds: STATE_TTL_SEC,
          allowCreate: expectedRev === 0,
        });
        if (!ok) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: 'combat state revision mismatch',
            currentRev: (await this.readState(state.sessionId))?.rev ?? null,
          });
        }
        return next;
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof ServiceUnavailableException) throw e;
        this.log.warn(`writeState ${state.sessionId}: ${(e as Error).message}`);
        throw this.unavailable(
          `Brawler combat write failed: ${(e as Error).message}`,
        );
      }
    }

    this.assertMemoryFallbackAllowed('write');

    const cur = this.memory.get(state.sessionId);
    if (cur && cur.rev !== expectedRev) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'combat state revision mismatch',
        currentRev: cur.rev,
      });
    }
    if (!cur && expectedRev !== 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'combat state revision mismatch',
        currentRev: null,
      });
    }
    this.memory.set(state.sessionId, next);
    return next;
  }

  async mutateState(
    sessionId: string,
    mutator: (
      state: BrawlerCombatLiveStateV1,
    ) => BrawlerCombatLiveStateV1 | null,
  ): Promise<BrawlerCombatLiveStateV1> {
    for (let attempt = 0; attempt < CAS_MAX_ATTEMPTS; attempt++) {
      const current = await this.readState(sessionId);
      if (!current) {
        throw this.unavailable(
          `Brawler combat mutate failed: missing state for ${sessionId}`,
        );
      }
      const next = mutator({
        ...current,
        fighters: current.fighters.map((f) => ({
          ...f,
          cooldowns: { ...f.cooldowns },
          buffs: [...f.buffs],
        })),
        projectiles: [...current.projectiles],
        world: { ...current.world },
      });
      if (!next) return current;
      try {
        return await this.writeState(next);
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
      }
    }
    throw new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      message: 'combat state revision mismatch after retries',
    });
  }

  async initState(
    input: CreateCombatStateInput,
  ): Promise<BrawlerCombatLiveStateV1> {
    const existing = await this.readState(input.sessionId);
    if (existing) return existing;
    const created = createEmptyCombatState(input);
    try {
      return await this.writeState(created);
    } catch (e) {
      if (!(e instanceof ConflictException)) throw e;
      const raced = await this.readState(input.sessionId);
      if (raced) return raced;
      throw e;
    }
  }

  async removeState(sessionId: string): Promise<void> {
    this.memory.delete(sessionId);
    this.memoryPresence.delete(sessionId);
    if (!this.redis.isEnabled()) return;
    try {
      await this.redis.del(this.stateKey(sessionId));
      await this.redis.del(this.lockKey(sessionId));
      await this.redis.del(this.presenceKey(sessionId));
    } catch (e) {
      this.log.warn(`removeState ${sessionId}: ${(e as Error).message}`);
      throw this.unavailable(
        `Brawler combat delete failed: ${(e as Error).message}`,
      );
    }
  }

  tryAcquireTickLock(
    sessionId: string,
    token: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (!this.redis.isEnabled()) {
      // Local memory mode: single-process owns the tick without Redis.
      return Promise.resolve(this.memoryAllowed);
    }
    return this.redis.tryAcquireLock({
      key: this.lockKey(sessionId),
      token,
      ttlMs,
    });
  }

  renewTickLock(
    sessionId: string,
    token: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (!this.redis.isEnabled()) {
      return Promise.resolve(this.memoryAllowed);
    }
    return this.redis.renewLock({
      key: this.lockKey(sessionId),
      token,
      ttlMs,
    });
  }

  releaseTickLock(sessionId: string, token: string): Promise<boolean> {
    if (!this.redis.isEnabled()) {
      return Promise.resolve(this.memoryAllowed);
    }
    return this.redis.releaseLock({
      key: this.lockKey(sessionId),
      token,
    });
  }

  async readPresence(sessionId: string): Promise<Record<string, number>> {
    if (this.redis.isEnabled()) {
      try {
        const raw = await this.redis.get(this.presenceKey(sessionId));
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, number>;
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (e) {
        this.log.warn(`readPresence ${sessionId}: ${(e as Error).message}`);
        return {};
      }
    }
    this.assertMemoryFallbackAllowed('read presence');
    return { ...(this.memoryPresence.get(sessionId) ?? {}) };
  }

  async initPresence(
    sessionId: string,
    participantLastInputMs: Record<string, number>,
  ): Promise<void> {
    if (this.redis.isEnabled()) {
      try {
        await this.redis.setEx(
          this.presenceKey(sessionId),
          STATE_TTL_SEC,
          JSON.stringify(participantLastInputMs),
        );
        return;
      } catch (e) {
        this.log.warn(`initPresence ${sessionId}: ${(e as Error).message}`);
        throw this.unavailable(
          `Brawler combat presence init failed: ${(e as Error).message}`,
        );
      }
    }
    this.assertMemoryFallbackAllowed('init presence');
    this.memoryPresence.set(sessionId, { ...participantLastInputMs });
  }

  async touchInput(
    sessionId: string,
    participantId: string,
    atMs: number,
  ): Promise<void> {
    const map = await this.readPresence(sessionId);
    map[participantId] = atMs;
    if (this.redis.isEnabled()) {
      try {
        await this.redis.setEx(
          this.presenceKey(sessionId),
          STATE_TTL_SEC,
          JSON.stringify(map),
        );
        return;
      } catch (e) {
        this.log.warn(`touchInput ${sessionId}: ${(e as Error).message}`);
        throw this.unavailable(
          `Brawler combat presence touch failed: ${(e as Error).message}`,
        );
      }
    }
    this.assertMemoryFallbackAllowed('touch presence');
    this.memoryPresence.set(sessionId, map);
  }
}
