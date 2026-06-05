export const BRAWLER_ARENA_STATE_VERSION = 1 as const;

export const BRAWLER_ARENA_SPAWN_INTERVAL_MS = 6500;
export const BRAWLER_ARENA_MAX_ON_MAP = 3;
export const BRAWLER_ARENA_PICKUP_RADIUS_PX = 28;

export type BrawlerArenaSpawn = {
  spawnId: string;
  powerupId: string;
  x: number;
  y: number;
};

export type BrawlerArenaBuff = {
  powerupId: string;
  effectType: string;
  magnitude: number;
  startedAtMs: number;
  endsAtMs: number;
};

export type BrawlerArenaLiveStateV1 = {
  v: typeof BRAWLER_ARENA_STATE_VERSION;
  sessionId: string;
  rev: number;
  spawns: BrawlerArenaSpawn[];
  pickedSpawnIds: string[];
  buffsByParticipant: Record<string, BrawlerArenaBuff[]>;
  lastSpawnAtMs: number;
};

export type BrawlerPowerupConfigRow = {
  id: string;
  displayName?: string;
  effectType: string;
  magnitude: number;
  durationMs: number;
  spawnWeight: number;
};
