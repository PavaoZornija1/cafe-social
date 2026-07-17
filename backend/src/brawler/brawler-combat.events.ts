import type { BrawlerCombatLiveStateV1 } from './brawler-combat.types';

export const BRAWLER_COMBAT_EVENT = 'brawler.combat' as const;
export const BRAWLER_COMBAT_ENDED_EVENT = 'brawler.combat.ended' as const;

export type BrawlerCombatSocketPayload = {
  sessionId: string;
  type: 'snapshot';
  state: BrawlerCombatLiveStateV1;
};

export type BrawlerCombatEndedPayload = {
  sessionId: string;
  state: BrawlerCombatLiveStateV1;
};
