import type { BrawlerPowerupDef, SpawnedPowerup } from './types';

export type BrawlerArenaSocketPayload = {
  sessionId: string;
  type: 'state' | 'spawned' | 'picked';
  rev: number;
  spawns?: SpawnedPowerup[];
  spawn?: SpawnedPowerup;
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
}): { powerupsOnMap: SpawnedPowerup[]; changed: boolean } {
  const { payload } = params;
  let powerupsOnMap = params.powerupsOnMap;
  let changed = false;

  if (payload.type === 'state' && payload.spawns) {
    const next = mergeArenaSpawns([], payload.spawns);
    if (next.length !== powerupsOnMap.length) changed = true;
    powerupsOnMap = next;
    changed = true;
  }

  if (payload.type === 'spawned' && payload.spawn) {
    if (!powerupsOnMap.some((s) => s.spawnId === payload.spawn!.spawnId)) {
      powerupsOnMap = [...powerupsOnMap, payload.spawn];
      changed = true;
    }
  }

  if (payload.type === 'picked' && payload.picked) {
    const beforeLen = powerupsOnMap.length;
    powerupsOnMap = powerupsOnMap.filter((s) => s.spawnId !== payload.picked!.spawnId);
    if (powerupsOnMap.length !== beforeLen) changed = true;
  }

  return { powerupsOnMap, changed };
}
