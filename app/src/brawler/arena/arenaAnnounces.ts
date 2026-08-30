import type { MatchPhaseKey } from './combat';
import type { TrackedParticipant } from './types';

export type ArenaAnnounceKind =
  | 'phase_chaos'
  | 'phase_endgame'
  | 'phase_sudden_death'
  | 'death_duel'
  | 'fighters_left';

export type ArenaAnnounce = {
  kind: ArenaAnnounceKind;
  title: string;
  subtitle?: string;
};

export function announceForPhase(phaseKey: MatchPhaseKey): ArenaAnnounce {
  switch (phaseKey) {
    case 'chaos':
      return { kind: 'phase_chaos', title: 'CHAOS', subtitle: 'Brace yourself!' };
    case 'endgame':
      return { kind: 'phase_endgame', title: 'ENDGAME', subtitle: 'No more chill.' };
    case 'sudden_death':
      return {
        kind: 'phase_sudden_death',
        title: 'SUDDEN DEATH',
        subtitle: 'Run for your lives!',
      };
  }
}

export const DEATH_DUEL_ANNOUNCE: ArenaAnnounce = {
  kind: 'death_duel',
  title: 'DEATH DUEL!',
  subtitle: 'Only one walks away.',
};

export function fightersLeftAnnounce(alive: number): ArenaAnnounce {
  return {
    kind: 'fighters_left',
    title: `${alive} fighters left`,
    subtitle: alive <= 2 ? 'Finish them!' : undefined,
  };
}

/** Alive fighters for duel announcements (local HP + elimination set). */
export function countAliveArenaParticipants(opts: {
  participants: TrackedParticipant[];
  localParticipantId: string | null;
  heroHp: number;
  eliminatedParticipantIds: ReadonlySet<string>;
}): number {
  const { participants, localParticipantId, heroHp, eliminatedParticipantIds } = opts;
  if (participants.length === 0) {
    return heroHp > 0 ? 1 : 0;
  }
  let alive = 0;
  for (const p of participants) {
    if (eliminatedParticipantIds.has(p.id)) continue;
    const isLocal = localParticipantId != null && p.id === localParticipantId;
    if (isLocal) {
      if (heroHp > 0) alive++;
      continue;
    }
    alive++;
  }
  return alive;
}
