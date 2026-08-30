import { applyCombatEndToState } from './brawler-combat-end.util';
import type {
  BrawlerCombatFighterV1,
  BrawlerCombatLiveStateV1,
} from './brawler-combat.types';

export function applyForfeitToFighter(
  f: BrawlerCombatFighterV1,
): BrawlerCombatFighterV1 {
  if (!f.alive) return f;
  return {
    ...f,
    alive: false,
    hp: 0,
    deaths: f.deaths + 1,
    forfeited: true,
    vx: 0,
    vy: 0,
  };
}

export function applyForfeitsToState(
  state: BrawlerCombatLiveStateV1,
  participantIds: readonly string[],
): BrawlerCombatLiveStateV1 {
  if (state.status !== 'ACTIVE' || participantIds.length === 0) {
    return state;
  }
  const idSet = new Set(participantIds);
  const fighters = state.fighters.map((f) =>
    idSet.has(f.participantId) ? applyForfeitToFighter(f) : f,
  );
  return applyCombatEndToState(state, fighters, { preferEndReason: 'FORFEIT' });
}
