import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import {
  allowMemoryGameRuntime,
  requireRedisGameRuntime,
  type GameRuntimeEnv,
} from './game-runtime-policy';

// `redis@5` types `createClient` with the bundled module commands and the active RESP version,
// so the unparameterized `RedisClientType` (defaults to RESP2) is incompatible with the
// concrete return type. We capture the actual return type to avoid the generic mismatch.
type RuntimeRedisClient = ReturnType<typeof createClient>;

/**
 * Dedicated Redis connection for **application** game runtime data (JSON snapshots, locks, etc.).
 * Separate from {@link RedisIoAdapter}'s pub/sub clients used only for Socket.IO room fan-out.
 */
@Injectable()
export class GameRuntimeRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(GameRuntimeRedisService.name);
  private client: RuntimeRedisClient | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.client?.isOpen === true;
  }

  private envSnapshot(redisUrl?: string): GameRuntimeEnv {
    return {
      NODE_ENV: this.config.get<string>('NODE_ENV'),
      REDIS_URL: redisUrl ?? this.config.get<string>('REDIS_URL'),
      GAME_RUNTIME_REQUIRE_REDIS: this.config.get<string>(
        'GAME_RUNTIME_REQUIRE_REDIS',
      ),
      GAME_RUNTIME_ALLOW_MEMORY: this.config.get<string>(
        'GAME_RUNTIME_ALLOW_MEMORY',
      ),
    };
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    const env = this.envSnapshot(url);
    if (!url) {
      if (requireRedisGameRuntime(env)) {
        throw new Error(
          'REDIS_URL is required for game runtime (production or GAME_RUNTIME_REQUIRE_REDIS=1). Set REDIS_URL, or use GAME_RUNTIME_ALLOW_MEMORY=1 only for local single-process debugging outside production.',
        );
      }
      if (allowMemoryGameRuntime(env)) {
        this.log.warn(
          'REDIS_URL not set — game runtime using explicit in-memory fallback (GAME_RUNTIME_ALLOW_MEMORY=1)',
        );
      } else {
        this.log.warn(
          'REDIS_URL not set — Redis game runtime store is disabled (DB-only; arena/combat ops that need live store will fail closed)',
        );
      }
      return;
    }
    const c = createClient({ url });
    c.on('error', (err) => this.log.error(`Redis runtime client: ${(err as Error).message}`));
    await c.connect();
    this.client = c;
    this.log.log('Redis game runtime client connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit().catch(() => undefined);
    }
    this.client = null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client?.isOpen) return null;
    return this.client.get(key);
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    if (!this.client?.isOpen) return;
    await this.client.setEx(key, ttlSeconds, value);
  }

  async del(key: string): Promise<void> {
    if (!this.client?.isOpen) return;
    await this.client.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (!this.client?.isOpen || keys.length === 0) return;
    await this.client.del(keys);
  }

  /** Monotonic counter (e.g. snapshot revision for optimistic concurrency). */
  async incr(key: string): Promise<number> {
    if (!this.client?.isOpen) return 0;
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client?.isOpen) return;
    await this.client.expire(key, ttlSeconds);
  }

  /**
   * Compare-and-set for JSON documents with a numeric `rev` field.
   * Writes `nextValue` only when the stored document's `rev` equals `expectedRev`
   * (or the key is missing and `expectedRev` is 0 / allowCreate).
   * Returns true when the write landed.
   */
  async compareAndSetJsonRev(params: {
    key: string;
    expectedRev: number;
    nextValue: string;
    ttlSeconds: number;
    allowCreate?: boolean;
  }): Promise<boolean> {
    if (!this.client?.isOpen) return false;
    const allowCreate = params.allowCreate === true ? '1' : '0';
    const result = await this.client.eval(
      `
      local raw = redis.call('GET', KEYS[1])
      if not raw then
        if ARGV[4] == '1' and tonumber(ARGV[1]) == 0 then
          redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
          return 1
        end
        return 0
      end
      local ok, decoded = pcall(cjson.decode, raw)
      if not ok or type(decoded) ~= 'table' or decoded['rev'] == nil then
        return 0
      end
      if tonumber(decoded['rev']) ~= tonumber(ARGV[1]) then
        return 0
      end
      redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
      return 1
      `,
      {
        keys: [params.key],
        arguments: [
          String(params.expectedRev),
          params.nextValue,
          String(params.ttlSeconds),
          allowCreate,
        ],
      },
    );
    return Number(result) === 1;
  }

  /**
   * Acquire a short-lived ownership lock (`SET key token NX PX ttl`).
   * Returns false when Redis is disabled or another owner holds the key.
   */
  async tryAcquireLock(params: {
    key: string;
    token: string;
    ttlMs: number;
  }): Promise<boolean> {
    if (!this.client?.isOpen) return false;
    const result = await this.client.set(params.key, params.token, {
      NX: true,
      PX: params.ttlMs,
    });
    return result === 'OK';
  }

  /** Extend lock TTL only if `token` still owns the key. */
  async renewLock(params: {
    key: string;
    token: string;
    ttlMs: number;
  }): Promise<boolean> {
    if (!this.client?.isOpen) return false;
    const result = await this.client.eval(
      `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]))
      end
      return 0
      `,
      {
        keys: [params.key],
        arguments: [params.token, String(params.ttlMs)],
      },
    );
    return Number(result) === 1;
  }

  /** Delete lock only if `token` still owns the key. */
  async releaseLock(params: {
    key: string;
    token: string;
  }): Promise<boolean> {
    if (!this.client?.isOpen) return false;
    const result = await this.client.eval(
      `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      end
      return 0
      `,
      {
        keys: [params.key],
        arguments: [params.token],
      },
    );
    return Number(result) === 1;
  }
}
