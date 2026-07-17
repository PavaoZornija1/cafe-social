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
  BRAWLER_ARENA_STATE_VERSION,
  type BrawlerArenaLiveStateV1,
} from './brawler-arena.types';
import { createEmptyArenaState } from './brawler-arena.util';

const KEY_PREFIX = 'v1:gm:brawler:arena:';
const STATE_TTL_SEC = 172800;
const CAS_MAX_ATTEMPTS = 8;

@Injectable()
export class BrawlerArenaRedisService {
  private readonly log = new Logger(BrawlerArenaRedisService.name);
  private readonly memory = new Map<string, BrawlerArenaLiveStateV1>();
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

  private key(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
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
      `Brawler arena ${op} unavailable: Redis game runtime is required (set REDIS_URL, or GAME_RUNTIME_ALLOW_MEMORY=1 for local single-process only)`,
    );
  }

  private parse(raw: string, sessionId: string): BrawlerArenaLiveStateV1 | null {
    try {
      const parsed = JSON.parse(raw) as BrawlerArenaLiveStateV1;
      if (
        parsed?.v !== BRAWLER_ARENA_STATE_VERSION ||
        parsed.sessionId !== sessionId ||
        !Array.isArray(parsed.spawns) ||
        !Array.isArray(parsed.pickedSpawnIds) ||
        typeof parsed.buffsByParticipant !== 'object'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async readState(sessionId: string): Promise<BrawlerArenaLiveStateV1 | null> {
    if (this.redis.isEnabled()) {
      try {
        const raw = await this.redis.get(this.key(sessionId));
        if (!raw) return null;
        return this.parse(raw, sessionId);
      } catch (e) {
        this.log.warn(`readState ${sessionId}: ${(e as Error).message}`);
        throw this.unavailable(
          `Brawler arena read failed: ${(e as Error).message}`,
        );
      }
    }
    this.assertMemoryFallbackAllowed('read');
    return this.memory.get(sessionId) ?? null;
  }

  /**
   * Compare-and-set write: increments `rev` only when the stored rev still matches
   * `state.rev` (the revision the caller read before mutating).
   */
  async writeState(state: BrawlerArenaLiveStateV1): Promise<BrawlerArenaLiveStateV1> {
    const expectedRev = state.rev;
    const next: BrawlerArenaLiveStateV1 = { ...state, rev: state.rev + 1 };

    if (this.redis.isEnabled()) {
      try {
        const ok = await this.redis.compareAndSetJsonRev({
          key: this.key(state.sessionId),
          expectedRev,
          nextValue: JSON.stringify(next),
          ttlSeconds: STATE_TTL_SEC,
          allowCreate: expectedRev === 0,
        });
        if (!ok) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            message: 'arena state revision mismatch',
            currentRev: (await this.readState(state.sessionId))?.rev ?? null,
          });
        }
        return next;
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        if (e instanceof ServiceUnavailableException) throw e;
        this.log.warn(`writeState ${state.sessionId}: ${(e as Error).message}`);
        throw this.unavailable(
          `Brawler arena write failed: ${(e as Error).message}`,
        );
      }
    }

    this.assertMemoryFallbackAllowed('write');

    const cur = this.memory.get(state.sessionId);
    if (cur && cur.rev !== expectedRev) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'arena state revision mismatch',
        currentRev: cur.rev,
      });
    }
    if (!cur && expectedRev !== 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'arena state revision mismatch',
        currentRev: null,
      });
    }
    this.memory.set(state.sessionId, next);
    return next;
  }

  /**
   * Retry helper for tick/pick paths: re-read + apply mutator until CAS succeeds.
   */
  async mutateState(
    sessionId: string,
    mutator: (state: BrawlerArenaLiveStateV1) => BrawlerArenaLiveStateV1 | null,
  ): Promise<BrawlerArenaLiveStateV1> {
    for (let attempt = 0; attempt < CAS_MAX_ATTEMPTS; attempt++) {
      const current =
        (await this.readState(sessionId)) ?? (await this.initState(sessionId));
      const next = mutator({
        ...current,
        spawns: [...current.spawns],
        pickedSpawnIds: [...current.pickedSpawnIds],
        buffsByParticipant: { ...current.buffsByParticipant },
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
      message: 'arena state revision mismatch after retries',
    });
  }

  async initState(sessionId: string): Promise<BrawlerArenaLiveStateV1> {
    const existing = await this.readState(sessionId);
    if (existing) return existing;
    const created = createEmptyArenaState(sessionId);
    try {
      return await this.writeState(created);
    } catch (e) {
      if (!(e instanceof ConflictException)) throw e;
      const raced = await this.readState(sessionId);
      if (raced) return raced;
      throw e;
    }
  }

  async removeState(sessionId: string): Promise<void> {
    this.memory.delete(sessionId);
    if (!this.redis.isEnabled()) return;
    try {
      await this.redis.del(this.key(sessionId));
    } catch (e) {
      this.log.warn(`removeState ${sessionId}: ${(e as Error).message}`);
      throw this.unavailable(
        `Brawler arena delete failed: ${(e as Error).message}`,
      );
    }
  }
}
