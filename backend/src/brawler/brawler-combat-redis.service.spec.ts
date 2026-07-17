import {
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BrawlerCombatRedisService } from './brawler-combat-redis.service';
import {
  BRAWLER_COMBAT_STATE_VERSION,
  createEmptyCombatState,
} from './brawler-combat.types';

describe('BrawlerCombatRedisService', () => {
  function buildSvc(opts?: {
    allowMemory?: boolean;
    redisEnabled?: boolean;
    redis?: Partial<{
      get: jest.Mock;
      compareAndSetJsonRev: jest.Mock;
      del: jest.Mock;
      tryAcquireLock: jest.Mock;
      renewLock: jest.Mock;
      releaseLock: jest.Mock;
    }>;
  }) {
    const redisEnabled = opts?.redisEnabled === true;
    const redis = {
      isEnabled: () => redisEnabled,
      get: opts?.redis?.get ?? jest.fn().mockResolvedValue(null),
      compareAndSetJsonRev:
        opts?.redis?.compareAndSetJsonRev ?? jest.fn().mockResolvedValue(true),
      del: opts?.redis?.del ?? jest.fn().mockResolvedValue(undefined),
      tryAcquireLock:
        opts?.redis?.tryAcquireLock ?? jest.fn().mockResolvedValue(true),
      renewLock: opts?.redis?.renewLock ?? jest.fn().mockResolvedValue(true),
      releaseLock:
        opts?.redis?.releaseLock ?? jest.fn().mockResolvedValue(true),
    };
    const config = {
      get: (key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'GAME_RUNTIME_ALLOW_MEMORY') {
          return opts?.allowMemory === false ? undefined : '1';
        }
        return undefined;
      },
    };
    return {
      svc: new BrawlerCombatRedisService(redis as never, config as never),
      redis,
    };
  }

  it('throws when Redis is disabled and memory is not allowed', async () => {
    const { svc } = buildSvc({ allowMemory: false, redisEnabled: false });
    await expect(svc.readState('s1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      svc.writeState(
        createEmptyCombatState({
          sessionId: 's1',
          startedAtMs: 1,
          endsAtMs: 2,
          fighters: [],
        }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('CAS increments rev in memory mode', async () => {
    const { svc } = buildSvc({ allowMemory: true, redisEnabled: false });
    const init = await svc.initState({
      sessionId: 's1',
      startedAtMs: 1000,
      endsAtMs: 90000,
      fighters: [
        {
          participantId: 'p1',
          playerId: 'pl1',
          isBot: false,
          x: 0.25,
          y: 0.8,
          vx: 0,
          vy: 0,
          facing: 1,
          hp: 100,
          maxHp: 100,
          alive: true,
          kills: 0,
          deaths: 0,
          cooldowns: {},
          buffs: [],
        },
      ],
    });
    expect(init.v).toBe(BRAWLER_COMBAT_STATE_VERSION);
    expect(init.rev).toBe(1);
    expect(init.status).toBe('ACTIVE');

    const next = await svc.writeState({ ...init, tick: 5 });
    expect(next.rev).toBe(2);
    expect(next.tick).toBe(5);

    await expect(svc.writeState({ ...init, tick: 99 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not fall through to memory when Redis write errors', async () => {
    const { svc } = buildSvc({
      redisEnabled: true,
      allowMemory: false,
      redis: {
        compareAndSetJsonRev: jest
          .fn()
          .mockRejectedValue(new Error('redis down')),
      },
    });
    await expect(
      svc.writeState(
        createEmptyCombatState({
          sessionId: 's-redis',
          startedAtMs: 1,
          endsAtMs: 2,
          fighters: [],
        }),
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(svc.readState('s-redis')).resolves.toBeNull();
  });

  it('delegates tick lock acquire/renew/release to Redis', async () => {
    const { svc, redis } = buildSvc({
      redisEnabled: true,
      allowMemory: false,
    });
    await expect(svc.tryAcquireTickLock('s1', 'token-a', 150)).resolves.toBe(
      true,
    );
    expect(redis.tryAcquireLock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'v1:gm:brawler:combat:lock:s1',
        token: 'token-a',
        ttlMs: 150,
      }),
    );
    await svc.renewTickLock('s1', 'token-a', 150);
    await svc.releaseTickLock('s1', 'token-a');
    expect(redis.renewLock).toHaveBeenCalled();
    expect(redis.releaseLock).toHaveBeenCalled();
  });
});
