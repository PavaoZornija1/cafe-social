import { randomUUID } from 'crypto';
import { pickRandomPowerupSpawnPosition } from './brawler-arena-platforms.util';
import {
  BRAWLER_ARENA_MAX_ON_MAP,
  BRAWLER_ARENA_PICKUP_RADIUS_PX,
  BRAWLER_ARENA_SPAWN_INTERVAL_MS,
  BRAWLER_ARENA_STATE_VERSION,
  type BrawlerArenaLiveStateV1,
  type BrawlerArenaSpawn,
  type BrawlerPowerupConfigRow,
} from './brawler-arena.types';

export function createEmptyArenaState(sessionId: string): BrawlerArenaLiveStateV1 {
  return {
    v: BRAWLER_ARENA_STATE_VERSION,
    sessionId,
    rev: 0,
    spawns: [],
    pickedSpawnIds: [],
    buffsByParticipant: {},
    lastSpawnAtMs: 0,
  };
}

export function pickWeightedPowerup(defs: BrawlerPowerupConfigRow[]): BrawlerPowerupConfigRow | null {
  if (!defs.length) return null;
  const totalW = defs.reduce((acc, d) => acc + Math.max(0, d.spawnWeight || 0), 0);
  if (totalW <= 0) return defs[0]!;
  let r = Math.random() * totalW;
  for (const d of defs) {
    r -= Math.max(0, d.spawnWeight || 0);
    if (r <= 0) return d;
  }
  return defs[defs.length - 1]!;
}

export function maybeSpawnArenaPowerup(params: {
  state: BrawlerArenaLiveStateV1;
  atMs: number;
  worldW: number;
  worldH: number;
  powerupDefs: BrawlerPowerupConfigRow[];
}): BrawlerArenaSpawn | null {
  const { state, atMs, worldW, worldH, powerupDefs } = params;
  if (!powerupDefs.length) return null;
  if (state.spawns.length >= BRAWLER_ARENA_MAX_ON_MAP) return null;
  const spawnInterval =
    state.lastSpawnAtMs === 0 ? 3000 : BRAWLER_ARENA_SPAWN_INTERVAL_MS;
  if (atMs - state.lastSpawnAtMs < spawnInterval) return null;

  const pick = pickWeightedPowerup(powerupDefs);
  if (!pick) return null;

  const pos = pickRandomPowerupSpawnPosition(worldW, worldH);
  if (!pos) return null;

  const spawn: BrawlerArenaSpawn = {
    spawnId: `${state.sessionId}-${atMs}-${randomUUID().slice(0, 8)}`,
    powerupId: pick.id,
    x: pos.x,
    y: pos.y,
  };
  state.lastSpawnAtMs = atMs;
  state.spawns = [...state.spawns, spawn];
  return spawn;
}

export function arenaSpawnsForClient(state: BrawlerArenaLiveStateV1) {
  return state.spawns.map((s) => ({
    ...s,
    r: BRAWLER_ARENA_PICKUP_RADIUS_PX,
  }));
}
