export type QuestPeriod = 'daily' | 'weekly';

export type PlatformQuestIcon =
  | 'location'
  | 'trophy'
  | 'game-controller'
  | 'sparkles'
  | 'flash'
  | 'map'
  | 'calendar'
  | 'star';

export type PlatformQuestDefinition = {
  key: string;
  title: string;
  targetCount: number;
  xpReward: number;
  icon: PlatformQuestIcon;
  sortOrder: number;
};

export type PlatformQuestBundleDefinition = {
  key: string;
  title: string;
  xpReward: number;
  /** Fallback label when no CMS link is configured. */
  bonusLabelFallback: string;
};

export const DAILY_PLATFORM_QUESTS: PlatformQuestDefinition[] = [
  {
    key: 'check_in',
    title: 'Check in at a partner café',
    targetCount: 1,
    xpReward: 50,
    icon: 'location',
    sortOrder: 1,
  },
  {
    key: 'earn_xp',
    title: 'Earn 400 XP today',
    targetCount: 400,
    xpReward: 100,
    icon: 'trophy',
    sortOrder: 2,
  },
  {
    key: 'win_word_rooms',
    title: 'Win 3 Word Rooms',
    targetCount: 3,
    xpReward: 150,
    icon: 'game-controller',
    sortOrder: 3,
  },
  {
    key: 'solve_daily_word',
    title: "Solve today's Daily Word",
    targetCount: 1,
    xpReward: 30,
    icon: 'sparkles',
    sortOrder: 4,
  },
  {
    key: 'play_match',
    title: 'Finish a game at a partner café',
    targetCount: 1,
    xpReward: 70,
    icon: 'flash',
    sortOrder: 5,
  },
  {
    key: 'explore_venues',
    title: 'Visit 2 partner cafés today',
    targetCount: 2,
    xpReward: 50,
    icon: 'map',
    sortOrder: 6,
  },
];

export const WEEKLY_PLATFORM_QUESTS: PlatformQuestDefinition[] = [
  {
    key: 'visit_days',
    title: 'Visit partner cafés on 5 days',
    targetCount: 5,
    xpReward: 200,
    icon: 'calendar',
    sortOrder: 1,
  },
  {
    key: 'win_games',
    title: 'Win 10 games this week',
    targetCount: 10,
    xpReward: 250,
    icon: 'game-controller',
    sortOrder: 2,
  },
  {
    key: 'solve_daily_words',
    title: 'Solve the Daily Word 5 times',
    targetCount: 5,
    xpReward: 150,
    icon: 'sparkles',
    sortOrder: 3,
  },
  {
    key: 'earn_xp_week',
    title: 'Earn 2,000 XP this week',
    targetCount: 2000,
    xpReward: 300,
    icon: 'star',
    sortOrder: 4,
  },
];

export const DAILY_QUEST_BUNDLE: PlatformQuestBundleDefinition = {
  key: 'bundle',
  title: 'Complete all daily challenges',
  xpReward: 500,
  bonusLabelFallback: 'Partner perk',
};

export const WEEKLY_QUEST_BUNDLE: PlatformQuestBundleDefinition = {
  key: 'bundle',
  title: 'Complete all weekly challenges',
  xpReward: 1000,
  bonusLabelFallback: 'Partner perk',
};

export function questsForPeriod(period: QuestPeriod): PlatformQuestDefinition[] {
  return period === 'weekly' ? WEEKLY_PLATFORM_QUESTS : DAILY_PLATFORM_QUESTS;
}

export function bundleForPeriod(period: QuestPeriod): PlatformQuestBundleDefinition {
  return period === 'weekly' ? WEEKLY_QUEST_BUNDLE : DAILY_QUEST_BUNDLE;
}

export function periodKeyFor(period: QuestPeriod, now = new Date()): string {
  if (period === 'daily') {
    return now.toISOString().slice(0, 10);
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d.toISOString().slice(0, 10);
}

export function msUntilPeriodEnd(period: QuestPeriod, now = new Date()): number {
  if (period === 'daily') {
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    return Math.max(0, end.getTime() - now.getTime());
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday + 7);
  return Math.max(0, d.getTime() - now.getTime());
}

export function fullQuestKey(period: QuestPeriod, key: string): string {
  return `${period}.${key}`;
}
