import type { BrawlerCombatLiveStateV1 } from './brawler-combat.types';

export type CombatFinalizeParticipant = {
  participantId: string;
  placement: number;
  score: number;
  result: 'WIN' | 'LOSS' | 'DRAW';
  kills: number;
  deaths: number;
};

export type CombatFinalizePayload = {
  winnerParticipantId: string | undefined;
  participants: CombatFinalizeParticipant[];
  endReason: BrawlerCombatLiveStateV1['endReason'];
};

function rankFightersForFinalize(state: BrawlerCombatLiveStateV1) {
  return [...state.fighters].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.deaths - b.deaths;
  });
}

/**
 * Build Postgres finalize payload from an ENDED combat document.
 * Client-supplied winner/kills must not be used when this returns.
 */
export function buildFinalizeFromCombat(
  state: BrawlerCombatLiveStateV1,
): CombatFinalizePayload {
  if (state.status !== 'ENDED') {
    throw new Error('combat is not ended');
  }

  const ranked = rankFightersForFinalize(state);
  const winnerId = state.winnerParticipantId ?? undefined;
  const living = state.fighters.filter((f) => f.alive);
  const isDraw =
    !winnerId &&
    (state.endReason === 'TIME' || living.length !== 1);

  const placementById = new Map<string, number>();
  ranked.forEach((f, idx) => {
    placementById.set(f.participantId, idx + 1);
  });

  const participants: CombatFinalizeParticipant[] = state.fighters.map((f) => {
    const placement = placementById.get(f.participantId) ?? state.fighters.length;
    let result: 'WIN' | 'LOSS' | 'DRAW' = 'LOSS';
    if (isDraw && placement === 1) result = 'DRAW';
    else if (winnerId && f.participantId === winnerId) result = 'WIN';
    return {
      participantId: f.participantId,
      placement,
      score: f.kills,
      result,
      kills: f.kills,
      deaths: f.deaths,
    };
  });

  return {
    winnerParticipantId: isDraw ? undefined : winnerId,
    participants,
    endReason: state.endReason,
  };
}
