import { Injectable, Logger } from '@nestjs/common';
import { GameRuntimeRedisService } from '../redis/game-runtime-redis.service';
import {
  BRAWLER_ARENA_STATE_VERSION,
  type BrawlerArenaLiveStateV1,
} from './brawler-arena.types';
import { createEmptyArenaState } from './brawler-arena.util';

const KEY_PREFIX = 'v1:gm:brawler:arena:';
const STATE_TTL_SEC = 172800;

@Injectable()
export class BrawlerArenaRedisService {
  private readonly log = new Logger(BrawlerArenaRedisService.name);
  private readonly memory = new Map<string, BrawlerArenaLiveStateV1>();

  constructor(private readonly redis: GameRuntimeRedisService) {}

  private key(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
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
        return null;
      }
    }
    return this.memory.get(sessionId) ?? null;
  }

  async writeState(state: BrawlerArenaLiveStateV1): Promise<BrawlerArenaLiveStateV1> {
    const next = { ...state, rev: state.rev + 1 };
    if (this.redis.isEnabled()) {
      try {
        await this.redis.setEx(this.key(state.sessionId), STATE_TTL_SEC, JSON.stringify(next));
      } catch (e) {
        this.log.warn(`writeState ${state.sessionId}: ${(e as Error).message}`);
      }
    }
    this.memory.set(state.sessionId, next);
    return next;
  }

  async initState(sessionId: string): Promise<BrawlerArenaLiveStateV1> {
    const existing = await this.readState(sessionId);
    if (existing) return existing;
    const created = createEmptyArenaState(sessionId);
    return this.writeState(created);
  }

  async removeState(sessionId: string): Promise<void> {
    this.memory.delete(sessionId);
    if (!this.redis.isEnabled()) return;
    try {
      await this.redis.del(this.key(sessionId));
    } catch (e) {
      this.log.warn(`removeState ${sessionId}: ${(e as Error).message}`);
    }
  }
}
