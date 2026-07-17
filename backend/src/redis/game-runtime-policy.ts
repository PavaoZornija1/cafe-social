export type GameRuntimeEnv = {
  NODE_ENV?: string;
  REDIS_URL?: string;
  GAME_RUNTIME_REQUIRE_REDIS?: string;
  GAME_RUNTIME_ALLOW_MEMORY?: string;
};

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/** Production (and explicit opt-in) must have Redis for live game runtime. */
export function requireRedisGameRuntime(env: GameRuntimeEnv): boolean {
  if (isTruthyFlag(env.GAME_RUNTIME_REQUIRE_REDIS)) return true;
  return (env.NODE_ENV ?? '').toLowerCase() === 'production';
}

/**
 * In-memory arena/combat fallback is only for explicit local single-process
 * debugging. Never allowed when Redis is required.
 */
export function allowMemoryGameRuntime(env: GameRuntimeEnv): boolean {
  if (requireRedisGameRuntime(env)) return false;
  return isTruthyFlag(env.GAME_RUNTIME_ALLOW_MEMORY);
}
