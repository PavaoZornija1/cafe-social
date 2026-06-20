import type { TFunction } from "i18next";

export type CampaignCopyTemplate = {
  id: string;
  label: string;
  name: string;
  title: string;
  body: string;
  segmentDays: number;
};

const CAMPAIGN_TEMPLATE_IDS = [
  "welcome_back",
  "happy_hour",
  "daily_word",
  "friends_table",
] as const;

const SEGMENT_DAYS: Record<(typeof CAMPAIGN_TEMPLATE_IDS)[number], number> = {
  welcome_back: 30,
  happy_hour: 14,
  daily_word: 21,
  friends_table: 30,
};

/** Suggested push copy — owners should still adapt tone to their brand. */
export function getCampaignCopyTemplates(t: TFunction): CampaignCopyTemplate[] {
  return CAMPAIGN_TEMPLATE_IDS.map((id) => ({
    id,
    label: t(`admin.partnerCampaignTemplates.${id}.label`),
    name: t(`admin.partnerCampaignTemplates.${id}.name`),
    title: t(`admin.partnerCampaignTemplates.${id}.title`),
    body: t(`admin.partnerCampaignTemplates.${id}.body`),
    segmentDays: SEGMENT_DAYS[id],
  }));
}
