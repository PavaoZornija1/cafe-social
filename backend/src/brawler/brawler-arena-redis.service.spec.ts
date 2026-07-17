import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BrawlerArenaRedisService } from './brawler-arena-redis.service';
import { createEmptyArenaState } from './brawler-arena.util';

describe('BrawlerArenaRedisService CAS (memory)', () => {
  function buildSvc(opts?: { allowMemory?: boolean }) {
    const redis = {
      isEnabled: () => false,
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      compareAndSetJsonRev: jest.fn(),
    };
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'GAME_RUNTIME_ALLOW_MEMORY') {
          return opts?.allowMemory === false ? undefined : '1';
        }
        if (key === 'GAME_RUNTIME_REQUIRE_REDIS') return undefined;
        return undefined;
      },
    };
    return new BrawlerArenaRedisService(redis as never, config as never);
  }

  it('increments rev on successful write', async () => {
    const svc = buildSvc();
    const init = await svc.initState('s1');
    expect(init.rev).toBe(1);

    const next = await svc.writeState({ ...init, lastSpawnAtMs: 10 });
    expect(next.rev).toBe(2);
    expect(next.lastSpawnAtMs).toBe(10);
  });

  it('rejects stale rev writes', async () => {
    const svc = buildSvc();
    const init = await svc.initState('s1');
    await svc.writeState({ ...init, lastSpawnAtMs: 1 });

    await expect(svc.writeState({ ...init, lastSpawnAtMs: 99 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('mutateState retries after a CAS conflict', async () => {
    const svc = buildSvc();
    await svc.initState('s1');

    let failOnce = true;
    const realWrite = svc.writeState.bind(svc);
    jest.spyOn(svc, 'writeState').mockImplementation(async (state) => {
      if (failOnce) {
        failOnce = false;
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'arena state revision mismatch',
        });
      }
      return realWrite(state);
    });

    const written = await svc.mutateState('s1', (state) => ({
      ...state,
      lastSpawnAtMs: 42,
    }));

    expect(written.lastSpawnAtMs).toBe(42);
    expect(svc.writeState).toHaveBeenCalledTimes(2);
  });

  it('throws when Redis is disabled and memory fallback is not allowed', async () => {
    const svc = buildSvc({ allowMemory: false });
    await expect(svc.readState('s1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      svc.writeState(createEmptyArenaState('s1')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('BrawlerArenaRedisService fail-closed (Redis)', () => {
  function buildRedisSvc(redis: {
    isEnabled: () => boolean;
    get: jest.Mock;
    compareAndSetJsonRev: jest.Mock;
    del: jest.Mock;
  }) {
    const config = {
      get: () => undefined,
    };
    return new BrawlerArenaRedisService(redis as never, config as never);
  }

  it('does not fall through to memory when Redis write errors', async () => {
    const redis = {
      isEnabled: () => true,
      get: jest.fn().mockResolvedValue(null),
      compareAndSetJsonRev: jest
        .fn()
        .mockRejectedValue(new Error('redis write failed')),
      del: jest.fn(),
    };
    const svc = buildRedisSvc(redis);

    await expect(
      svc.writeState(createEmptyArenaState('s-redis')),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    // A subsequent read with Redis returning null must not invent memory state.
    await expect(svc.readState('s-redis')).resolves.toBeNull();
  });

  it('surfaces Redis read errors instead of silent null + memory', async () => {
    const redis = {
      isEnabled: () => true,
      get: jest.fn().mockRejectedValue(new Error('redis read failed')),
      compareAndSetJsonRev: jest.fn(),
      del: jest.fn(),
    };
    const svc = buildRedisSvc(redis);

    await expect(svc.readState('s-redis')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
