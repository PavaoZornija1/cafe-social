export const BRAWLER_ARENA_EVENT = 'brawler.arena' as const;

export type BrawlerArenaSocketSpawn = {
  spawnId: string;
  powerupId: string;
  /** Fraction of world width (0–1). */
  nx: number;
  /** Fraction of world height (0–1). */
  ny: number;
  r: number;
};

export type BrawlerArenaSocketPayload = {
  sessionId: string;
  type: 'state' | 'spawned' | 'picked';
  rev: number;
  spawns?: BrawlerArenaSocketSpawn[];
  spawn?: BrawlerArenaSocketSpawn;
  picked?: {
    spawnId: string;
    actorParticipantId: string;
    powerupId: string;
    effectType: string;
    magnitude: number;
    startedAtMs: number;
    endsAtMs: number;
  };
};
