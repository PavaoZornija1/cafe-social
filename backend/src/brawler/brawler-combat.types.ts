export const BRAWLER_COMBAT_STATE_VERSION = 1 as const;

/** Authoritative combat simulation rate. */
export const BRAWLER_COMBAT_TICK_HZ = 20;
export const BRAWLER_COMBAT_TICK_MS = 1000 / BRAWLER_COMBAT_TICK_HZ;

/** Lock TTL ~2–3× tick so a stalled owner releases quickly. */
export const BRAWLER_COMBAT_LOCK_TTL_MS = Math.ceil(BRAWLER_COMBAT_TICK_MS * 3);

export type BrawlerCombatStatus = 'ACTIVE' | 'ENDED';

export type BrawlerCombatEndReason = 'KO' | 'TIME' | 'FORFEIT' | 'ABORT';

export type BrawlerCombatBuffV1 = {
  powerupId: string;
  untilTick: number;
  magnitude: number;
};

export type BrawlerCombatFighterV1 = {
  participantId: string;
  playerId: string | null;
  isBot: boolean;
  /** Normalized world X (0–1). */
  x: number;
  /** Normalized world Y (0–1). */
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
  deaths: number;
  cooldowns: Record<string, number>;
  buffs: BrawlerCombatBuffV1[];
};

export type BrawlerCombatProjectileV1 = {
  id: string;
  ownerParticipantId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type BrawlerCombatLiveStateV1 = {
  v: typeof BRAWLER_COMBAT_STATE_VERSION;
  sessionId: string;
  rev: number;
  status: BrawlerCombatStatus;
  startedAtMs: number;
  endsAtMs: number;
  tick: number;
  /** Logical world size; fighters use normalized 0–1 coords against this. */
  world: { w: number; h: number };
  fighters: BrawlerCombatFighterV1[];
  projectiles: BrawlerCombatProjectileV1[];
  winnerParticipantId?: string | null;
  endReason?: BrawlerCombatEndReason;
};

export type CreateCombatStateInput = {
  sessionId: string;
  startedAtMs: number;
  endsAtMs: number;
  fighters: BrawlerCombatFighterV1[];
  world?: { w: number; h: number };
};

export function createEmptyCombatState(
  input: CreateCombatStateInput,
): BrawlerCombatLiveStateV1 {
  return {
    v: BRAWLER_COMBAT_STATE_VERSION,
    sessionId: input.sessionId,
    rev: 0,
    status: 'ACTIVE',
    startedAtMs: input.startedAtMs,
    endsAtMs: input.endsAtMs,
    tick: 0,
    world: input.world ?? { w: 1, h: 1 },
    fighters: input.fighters.map((f) => ({
      ...f,
      cooldowns: { ...f.cooldowns },
      buffs: [...f.buffs],
    })),
    projectiles: [],
  };
}
