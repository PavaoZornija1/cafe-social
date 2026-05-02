import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameRuntimeRedisService } from '../redis/game-runtime-redis.service';
import {
  loadWordMatchSnapshotFromDb,
  type WordMatchLiveSnapshotV1,
} from './word-match-snapshot.util';

const SNAPSHOT_KEY_PREFIX = 'v1:gm:word:';
/** Long TTL — refreshed on every mutation; stale keys expire if a process never cleans up. */
const SNAPSHOT_TTL_SEC = 172800;

@Injectable()
export class WordMatchLiveRedisService {
  private readonly log = new Logger(WordMatchLiveRedisService.name);

  constructor(
    private readonly redis: GameRuntimeRedisService,
    private readonly prisma: PrismaService,
  ) {}

  private key(sessionId: string): string {
    return `${SNAPSHOT_KEY_PREFIX}${sessionId}`;
  }

  /**
   * Read the last materialized snapshot from Redis (may be absent if Redis disabled or cold start).
   */
  async readSnapshot(sessionId: string): Promise<WordMatchLiveSnapshotV1 | null> {
    if (!this.redis.isEnabled()) return null;
    try {
      const raw = await this.redis.get(this.key(sessionId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WordMatchLiveSnapshotV1;
      if (parsed?.v !== 1 || parsed.sessionId !== sessionId) return null;
      if (!Array.isArray(parsed.wordIds) || parsed.wordIds.length === 0) return null;
      if (typeof parsed.rev !== 'number' || !Number.isFinite(parsed.rev)) return null;
      return parsed;
    } catch (e) {
      this.log.warn(`readSnapshot ${sessionId}: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Re-read Postgres and overwrite the Redis mirror (write-through after mutations).
   */
  async refreshSnapshot(sessionId: string): Promise<void> {
    if (!this.redis.isEnabled()) return;
    try {
      const snap = await loadWordMatchSnapshotFromDb(this.prisma, sessionId);
      if (!snap) {
        await this.removeSnapshot(sessionId);
        return;
      }
      const revKey = `${this.key(sessionId)}:rev`;
      const rev = await this.redis.incr(revKey);
      await this.redis.expire(revKey, SNAPSHOT_TTL_SEC);
      snap.rev = rev;
      await this.redis.setEx(this.key(sessionId), SNAPSHOT_TTL_SEC, JSON.stringify(snap));
    } catch (e) {
      this.log.warn(`refreshSnapshot ${sessionId}: ${(e as Error).message}`);
    }
  }

  async removeSnapshot(sessionId: string): Promise<void> {
    if (!this.redis.isEnabled()) return;
    try {
      await this.redis.delMany([this.key(sessionId), `${this.key(sessionId)}:rev`]);
    } catch (e) {
      this.log.warn(`removeSnapshot ${sessionId}: ${(e as Error).message}`);
    }
  }

  async removeSnapshots(sessionIds: string[]): Promise<void> {
    if (!this.redis.isEnabled() || sessionIds.length === 0) return;
    try {
      const keys = sessionIds.flatMap((id) => [this.key(id), `${this.key(id)}:rev`]);
      await this.redis.delMany(keys);
    } catch (e) {
      this.log.warn(`removeSnapshots: ${(e as Error).message}`);
    }
  }
}
