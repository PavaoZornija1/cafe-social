import type {
  BrawlerCombatEndReason,
  BrawlerCombatFighterV1,
  BrawlerCombatLiveStateV1,
  BrawlerCombatStatus,
} from './brawler-combat.types';

export function countHumanFighters(fighters: BrawlerCombatFighterV1[]): number {
  return fighters.filter((f) => !f.isBot).length;
}

export function livingHumanFighters(
  fighters: BrawlerCombatFighterV1[],
): BrawlerCombatFighterV1[] {
  return fighters.filter((f) => f.alive && !f.isBot);
}

function rankFighters(fighters: BrawlerCombatFighterV1[]): BrawlerCombatFighterV1[] {
  return [...fighters].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.deaths - b.deaths;
  });
}

export type ResolveCombatEndOpts = {
  nowMs?: number;
  /** When ending because all but one human were eliminated via forfeit/idle. */
  preferEndReason?: BrawlerCombatEndReason;
};

export type CombatEndResolution = {
  status: BrawlerCombatStatus;
  winnerParticipantId: string | null;
  endReason: BrawlerCombatEndReason | undefined;
};

/**
 * Decide match end from fighter standings. Used by stepCombat and forfeit paths.
 */
export function resolveCombatEnd(
  state: BrawlerCombatLiveStateV1,
  fighters: BrawlerCombatFighterV1[],
  opts?: ResolveCombatEndOpts,
): CombatEndResolution {
  const nowMs = opts?.nowMs ?? Date.now();
  const humanCount = countHumanFighters(fighters);
  const livingHumans = livingHumanFighters(fighters);
  const living = fighters.filter((f) => f.alive);

  if (humanCount >= 2) {
    if (livingHumans.length === 1) {
      return {
        status: 'ENDED',
        winnerParticipantId: livingHumans[0]!.participantId,
        endReason: opts?.preferEndReason ?? 'KO',
      };
    }
    if (livingHumans.length === 0) {
      return {
        status: 'ENDED',
        winnerParticipantId: null,
        endReason: opts?.preferEndReason ?? 'FORFEIT',
      };
    }
  } else if (living.length <= 1) {
    return {
      status: 'ENDED',
      winnerParticipantId: living[0]?.participantId ?? null,
      endReason: 'KO',
    };
  }

  if (nowMs >= state.endsAtMs) {
    const ranked = rankFighters(fighters);
    return {
      status: 'ENDED',
      winnerParticipantId: ranked[0]?.participantId ?? null,
      endReason: 'TIME',
    };
  }

  return {
    status: 'ACTIVE',
    winnerParticipantId: state.winnerParticipantId ?? null,
    endReason: state.endReason,
  };
}

export function applyCombatEndToState(
  state: BrawlerCombatLiveStateV1,
  fighters: BrawlerCombatFighterV1[],
  opts?: ResolveCombatEndOpts,
): BrawlerCombatLiveStateV1 {
  const end = resolveCombatEnd(state, fighters, opts);
  return {
    ...state,
    fighters,
    status: end.status,
    winnerParticipantId: end.winnerParticipantId,
    endReason: end.endReason,
  };
}
