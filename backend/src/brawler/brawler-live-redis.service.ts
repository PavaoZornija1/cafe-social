import { GameType } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { GameRuntimeRedisService } from '../redis/game-runtime-redis.service';
import { BrawlerRepository } from './brawler.repository';

const KEY_PREFIX = 'v1:gm:brawler:';
const SNAPSHOT_TTL_SEC = 172800;

export type BrawlerLiveEnvelopeV1 = {
  v: 1;
  rev: number;
  /** JSON round-trip of `findSessionById` (Dates → ISO strings). */
  session: unknown;
};

@Injectable()
export class BrawlerLiveRedisService {
  private readonly log = new Logger(BrawlerLiveRedisService.name);

  constructor(
    private readonly redis: GameRuntimeRedisService,
    private readonly brawlerRepo: BrawlerRepository,
  ) {}

  private key(sessionId: string): string {
    return `${KEY_PREFIX}${sessionId}`;
  }

  async readSession(sessionId: string): Promise<BrawlerLiveEnvelopeV1 | null> {
    if (!this.redis.isEnabled()) return null;
    try {
      const raw = await this.redis.get(this.key(sessionId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as BrawlerLiveEnvelopeV1;
      if (parsed?.v !== 1 || typeof parsed.rev !== 'number' || parsed.session == null) {
        return null;
      }
      const s = parsed.session as { id?: string; gameType?: string };
      if (s.id !== sessionId || s.gameType !== GameType.BRAWLER) return null;
      return parsed;
    } catch (e) {
      this.log.warn(`readSession ${sessionId}: ${(e as Error).message}`);
      return null;
    }
  }

  async refreshSnapshot(sessionId: string): Promise<void> {
    if (!this.redis.isEnabled()) return;
    try {
      const row = await this.brawlerRepo.findSessionById(sessionId);
      if (!row || row.gameType !== GameType.BRAWLER) {
        await this.removeSnapshot(sessionId);
        return;
      }
      const revKey = `${this.key(sessionId)}:rev`;
      const rev = await this.redis.incr(revKey);
      await this.redis.expire(revKey, SNAPSHOT_TTL_SEC);
      const session = JSON.parse(JSON.stringify(row));
      const body: BrawlerLiveEnvelopeV1 = { v: 1, rev, session };
      await this.redis.setEx(this.key(sessionId), SNAPSHOT_TTL_SEC, JSON.stringify(body));
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
}
