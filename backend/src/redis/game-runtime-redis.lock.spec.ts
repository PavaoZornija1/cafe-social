import { GameRuntimeRedisService } from './game-runtime-redis.service';

describe('GameRuntimeRedisService locks', () => {
  it('returns false for lock ops when Redis client is not connected', async () => {
    const config = {
      get: () => undefined,
    };
    const svc = new GameRuntimeRedisService(config as never);
    await expect(
      svc.tryAcquireLock({
        key: 'v1:gm:brawler:combat:lock:s1',
        token: 'pod-a',
        ttlMs: 150,
      }),
    ).resolves.toBe(false);
    await expect(
      svc.renewLock({
        key: 'v1:gm:brawler:combat:lock:s1',
        token: 'pod-a',
        ttlMs: 150,
      }),
    ).resolves.toBe(false);
    await expect(
      svc.releaseLock({
        key: 'v1:gm:brawler:combat:lock:s1',
        token: 'pod-a',
      }),
    ).resolves.toBe(false);
  });
});
