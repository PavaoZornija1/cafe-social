import {
  allowMemoryGameRuntime,
  requireRedisGameRuntime,
} from './game-runtime-policy';

describe('game-runtime-policy', () => {
  it('requires Redis in production by default', () => {
    expect(
      requireRedisGameRuntime({
        NODE_ENV: 'production',
        REDIS_URL: undefined,
        GAME_RUNTIME_REQUIRE_REDIS: undefined,
        GAME_RUNTIME_ALLOW_MEMORY: undefined,
      }),
    ).toBe(true);
  });

  it('requires Redis when GAME_RUNTIME_REQUIRE_REDIS=1', () => {
    expect(
      requireRedisGameRuntime({
        NODE_ENV: 'development',
        GAME_RUNTIME_REQUIRE_REDIS: '1',
      }),
    ).toBe(true);
  });

  it('does not require Redis in local development by default', () => {
    expect(
      requireRedisGameRuntime({
        NODE_ENV: 'development',
      }),
    ).toBe(false);
  });

  it('allows memory only when explicitly opted in and Redis is not required', () => {
    expect(
      allowMemoryGameRuntime({
        NODE_ENV: 'development',
        GAME_RUNTIME_ALLOW_MEMORY: '1',
      }),
    ).toBe(true);
    expect(
      allowMemoryGameRuntime({
        NODE_ENV: 'production',
        GAME_RUNTIME_ALLOW_MEMORY: '1',
      }),
    ).toBe(false);
    expect(
      allowMemoryGameRuntime({
        NODE_ENV: 'development',
        GAME_RUNTIME_REQUIRE_REDIS: '1',
        GAME_RUNTIME_ALLOW_MEMORY: '1',
      }),
    ).toBe(false);
  });
});
