export const BRAWLER_COMBAT_STATE_VERSION = 1 as const;

export type BrawlerCombatStatus = 'ACTIVE' | 'ENDED';
export type BrawlerCombatEndReason = 'KO' | 'TIME' | 'FORFEIT' | 'ABORT';

export type BrawlerCombatFighterSnapshot = {
  participantId: string;
  playerId: string | null;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  kills: number;
  deaths: number;
};

export type BrawlerCombatLiveStateSnapshot = {
  v: typeof BRAWLER_COMBAT_STATE_VERSION;
  sessionId: string;
  rev: number;
  status: BrawlerCombatStatus;
  startedAtMs: number;
  endsAtMs: number;
  tick: number;
  world: { w: number; h: number };
  fighters: BrawlerCombatFighterSnapshot[];
  winnerParticipantId?: string | null;
  endReason?: BrawlerCombatEndReason;
};

export type BrawlerCombatSocketPayload = {
  sessionId: string;
  type: 'snapshot';
  state: BrawlerCombatLiveStateSnapshot;
};

export type CombatReconcileResult = {
  ended: boolean;
  winnerParticipantId: string | null;
  localHp: number | null;
  localAlive: boolean | null;
  localKills: number | null;
  localDeaths: number | null;
  /** Pixel positions for fighters present in the snapshot. */
  fighterPixels: Array<{
    participantId: string;
    x: number;
    y: number;
    facing: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    isBot: boolean;
  }>;
};

export function reconcileCombatSnapshot(params: {
  state: BrawlerCombatLiveStateSnapshot;
  localParticipantId: string | null;
  worldW: number;
  worldH: number;
  bodyH: number;
}): CombatReconcileResult {
  const { state, localParticipantId, worldW, worldH, bodyH } = params;
  const local = localParticipantId
    ? state.fighters.find((f) => f.participantId === localParticipantId)
    : undefined;

  return {
    ended: state.status === 'ENDED',
    winnerParticipantId: state.winnerParticipantId ?? null,
    localHp: local ? local.hp : null,
    localAlive: local ? local.alive : null,
    localKills: local ? local.kills : null,
    localDeaths: local ? local.deaths : null,
    fighterPixels: state.fighters.map((f) => ({
      participantId: f.participantId,
      // Normalize (0–1) → top-left pixel of body, feet near ny * worldH.
      x: f.x * worldW,
      y: f.y * worldH - bodyH,
      facing: f.facing,
      hp: f.hp,
      maxHp: f.maxHp,
      alive: f.alive,
      isBot: f.isBot,
    })),
  };
}
