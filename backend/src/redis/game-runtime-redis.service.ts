import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

/**
 * Dedicated Redis connection for **application** game runtime data (JSON snapshots, locks, etc.).
 * Separate from {@link RedisIoAdapter}'s pub/sub clients used only for Socket.IO room fan-out.
 */
@Injectable()
export class GameRuntimeRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(GameRuntimeRedisService.name);
  private client: RedisClientType | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return this.client?.isOpen === true;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.log.warn('REDIS_URL not set — Redis game runtime store is disabled (DB-only)');
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
}
