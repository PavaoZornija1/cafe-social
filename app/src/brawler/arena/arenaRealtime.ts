import { denormalizeArenaSpawn } from './powerupCoords';
import type { BrawlerPowerupDef, SpawnedPowerup } from './types';

export type BrawlerArenaSocketSpawnNorm = {
  spawnId: string;
  powerupId: string;
  nx: number;
  ny: number;
  r: number;
};

export type BrawlerArenaSocketPayload = {
  sessionId: string;
  type: 'state' | 'spawned' | 'picked';
  rev: number;
  spawns?: BrawlerArenaSocketSpawnNorm[];
  spawn?: BrawlerArenaSocketSpawnNorm;
  picked?: {
    spawnId: string;
    actorParticipantId: string;
    powerupId: string;
    effectType: BrawlerPowerupDef['effectType'];
    magnitude: number;
    startedAtMs: number;
    endsAtMs: number;
  };
};

export function denormalizeSocketSpawns(
  spawns: BrawlerArenaSocketSpawnNorm[],
  worldW: number,
  worldH: number,
): SpawnedPowerup[] {
  return spawns.map((s) => {
    const { x, y, ...rest } = denormalizeArenaSpawn(s, worldW, worldH);
    return { ...rest, x, y };
  });
}

export function mergeArenaSpawns(
  current: SpawnedPowerup[],
  incoming: SpawnedPowerup[],
): SpawnedPowerup[] {
  const byId = new Map(current.map((s) => [s.spawnId, s]));
  for (const s of incoming) {
    if (!byId.has(s.spawnId)) byId.set(s.spawnId, s);
  }
  return [...byId.values()];
}

export function applyArenaSocketEvent(params: {
  payload: BrawlerArenaSocketPayload;
  powerupsOnMap: SpawnedPowerup[];
  worldW: number;
  worldH: number;
}): { powerupsOnMap: SpawnedPowerup[]; changed: boolean } {
  const { payload, worldW, worldH } = params;
  let powerupsOnMap = params.powerupsOnMap;
  let changed = false;

  if (payload.type === 'state' && payload.spawns) {
    const next = mergeArenaSpawns([], denormalizeSocketSpawns(payload.spawns, worldW, worldH));
    if (next.length !== powerupsOnMap.length) changed = true;
    powerupsOnMap = next;
    changed = true;
  }

  if (payload.type === 'spawned' && payload.spawn) {
    if (!powerupsOnMap.some((s) => s.spawnId === payload.spawn!.spawnId)) {
      const [denorm] = denormalizeSocketSpawns([payload.spawn], worldW, worldH);
      if (denorm) {
        powerupsOnMap = [...powerupsOnMap, denorm];
        changed = true;
      }
    }
  }

  if (payload.type === 'picked' && payload.picked) {
    const beforeLen = powerupsOnMap.length;
    powerupsOnMap = powerupsOnMap.filter((s) => s.spawnId !== payload.picked!.spawnId);
    if (powerupsOnMap.length !== beforeLen) changed = true;
  }

  return { powerupsOnMap, changed };
}
