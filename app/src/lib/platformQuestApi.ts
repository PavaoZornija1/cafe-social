import { apiGet, apiPost } from './api';

export type QuestPeriod = 'daily' | 'weekly';

export type PlatformQuestStatus = 'in_progress' | 'claimable' | 'claimed';

export type PlatformQuestIcon =
  | 'location'
  | 'trophy'
  | 'game-controller'
  | 'sparkles'
  | 'flash'
  | 'map'
  | 'calendar'
  | 'star';

export type PlatformQuestRow = {
  key: string;
  title: string;
  subtitle: string | null;
  targetCount: number;
  progressCount: number;
  xpReward: number;
  icon: PlatformQuestIcon;
  status: PlatformQuestStatus;
  claimedXp: number | null;
};

export type PlatformQuestHubPayload = {
  period: QuestPeriod;
  periodKey: string;
  resetsInMs: number;
  availableXp: number;
  bundle: {
    key: string;
    title: string;
    xpReward: number;
    bonusLabel: string;
    targetCount: number;
    completedCount: number;
    claimed: boolean;
    canClaim: boolean;
  };
  quests: PlatformQuestRow[];
};

export function fetchPlatformQuestHub(
  token: string,
  period: QuestPeriod,
): Promise<PlatformQuestHubPayload> {
  return apiGet<PlatformQuestHubPayload>(
    `/players/me/platform-quests?period=${encodeURIComponent(period)}`,
    token,
  );
}

export function claimPlatformQuest(
  token: string,
  period: QuestPeriod,
  questKey: string,
): Promise<PlatformQuestHubPayload> {
  return apiPost<PlatformQuestHubPayload>(
    `/players/me/platform-quests/${encodeURIComponent(questKey)}/claim?period=${encodeURIComponent(period)}`,
    {},
    token,
  );
}

export function formatQuestResetCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
