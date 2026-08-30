export const BRAWLER_COMBAT_STATE_VERSION = 2 as const;

export type BrawlerCombatStatus = 'ACTIVE' | 'ENDED';
export type BrawlerCombatEndReason = 'KO' | 'TIME' | 'FORFEIT' | 'ABORT';

export type BrawlerCombatFighterSnapshot = {
  participantId: string;
  playerId: string | null;
  isBot: boolean;
  brawlerHeroId?: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  forfeited?: boolean;
  kills: number;
  deaths: number;
};

export type BrawlerCombatLiveStateSnapshot = {
  v: number;
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

export type CombatFighterPixel = {
  participantId: string;
  brawlerHeroId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  isBot: boolean;
};

export type CombatReconcileResult = {
  ended: boolean;
  winnerParticipantId: string | null;
  localHp: number | null;
  localAlive: boolean | null;
  localForfeited: boolean;
  localKills: number | null;
  localDeaths: number | null;
  localX: number | null;
  localY: number | null;
  fighterPixels: CombatFighterPixel[];
  remoteFighters: CombatFighterPixel[];
};

function usesPixelCoords(state: BrawlerCombatLiveStateSnapshot): boolean {
  return state.v >= 2 || state.world.w > 10;
}

function toPixelFighter(
  f: BrawlerCombatFighterSnapshot,
  state: BrawlerCombatLiveStateSnapshot,
  worldW: number,
  worldH: number,
  bodyH: number,
): CombatFighterPixel {
  const pixel = usesPixelCoords(state);
  return {
    participantId: f.participantId,
    brawlerHeroId: f.brawlerHeroId ?? null,
    x: pixel ? f.x : f.x * worldW,
    y: pixel ? f.y : f.y * worldH - bodyH,
    vx: f.vx,
    vy: f.vy,
    facing: f.facing,
    hp: f.hp,
    maxHp: f.maxHp,
    alive: f.alive,
    isBot: f.isBot,
  };
}

export function reconcileCombatSnapshot(params: {
  state: BrawlerCombatLiveStateSnapshot;
  localParticipantId: string | null;
  worldW: number;
  worldH: number;
  bodyH: number;
  heroIdByParticipant?: Map<string, string | null | undefined>;
}): CombatReconcileResult {
  const { state, localParticipantId, worldW, worldH, bodyH, heroIdByParticipant } =
    params;
  const local = localParticipantId
    ? state.fighters.find((f) => f.participantId === localParticipantId)
    : undefined;

  const fighterPixels = state.fighters.map((f) => {
    const px = toPixelFighter(f, state, worldW, worldH, bodyH);
    const heroFromMap = heroIdByParticipant?.get(f.participantId);
    if (heroFromMap && !px.brawlerHeroId) {
      px.brawlerHeroId = heroFromMap ?? null;
    }
    return px;
  });

  const localPx = localParticipantId
    ? fighterPixels.find((f) => f.participantId === localParticipantId)
    : undefined;

  return {
    ended: state.status === 'ENDED',
    winnerParticipantId: state.winnerParticipantId ?? null,
    localHp: local ? local.hp : null,
    localAlive: local ? local.alive : null,
    localForfeited: local?.forfeited === true,
    localKills: local ? local.kills : null,
    localDeaths: local ? local.deaths : null,
    localX: localPx?.x ?? null,
    localY: localPx?.y ?? null,
    fighterPixels,
    remoteFighters: fighterPixels.filter(
      (f) => f.participantId !== localParticipantId,
    ),
  };
}
