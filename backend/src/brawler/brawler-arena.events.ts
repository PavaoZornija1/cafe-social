export const BRAWLER_ARENA_EVENT = 'brawler.arena' as const;

export type BrawlerArenaSocketPayload = {
  sessionId: string;
  type: 'state' | 'spawned' | 'picked';
  rev: number;
  spawns?: Array<{ spawnId: string; powerupId: string; x: number; y: number; r: number }>;
  spawn?: { spawnId: string; powerupId: string; x: number; y: number; r: number };
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
