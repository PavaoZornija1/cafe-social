export type PlatformQuestPeriod = 'daily' | 'weekly';

/** Stable reward keys — which perk they map to lives in `PlatformAutomatedReward` (CMS / seed). */
export function platformQuestBundleRewardKey(period: PlatformQuestPeriod): string {
  return `platform_quest.${period}.bundle`;
}

export function tierRewardKey(tierSlug: string): string {
  return `tier.${tierSlug}`;
}
