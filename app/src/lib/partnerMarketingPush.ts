/**
 * Partner marketing push payloads (campaigns, perk expiry reminders).
 * Payload `data` is stringified by Expo; always normalize with these helpers.
 */

export const VENUE_CAMPAIGN_PUSH_TYPE = 'venue_campaign' as const;
export const VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE = 'venue_proximity_arrival' as const;
export const PERK_EXPIRY_REMINDER_KIND = 'perk_expiry_reminder' as const;
export const DAILY_STREAK_AT_RISK_KIND = 'daily_streak_at_risk' as const;

export type VenueCampaignPushPayload = {
  type: typeof VENUE_CAMPAIGN_PUSH_TYPE;
  venueId: string;
  campaignId: string;
  venueName?: string;
  pushCategory: 'partner_marketing';
};

export type VenueProximityArrivalPushPayload = {
  type: typeof VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE;
  venueId: string;
  venueName?: string;
  pushCategory: 'partner_marketing';
};

export type PerkExpiryReminderPushPayload = {
  kind: typeof PERK_EXPIRY_REMINDER_KIND;
  venueId: string;
  redemptionId: string;
};

export type DailyStreakAtRiskPushPayload = {
  kind: typeof DAILY_STREAK_AT_RISK_KIND;
  scopeKey: string;
  venueId?: string;
  streak: number;
};

function readString(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === 'string' ? v : '';
}

function optionalTrimmed(raw: Record<string, unknown>, key: string): string | undefined {
  const s = readString(raw, key).trim();
  return s.length > 0 ? s : undefined;
}

export function parseVenueCampaignPayload(
  raw: Record<string, unknown>,
): VenueCampaignPushPayload | null {
  const venueId = optionalTrimmed(raw, 'venueId');
  const campaignId = optionalTrimmed(raw, 'campaignId');
  if (!venueId || !campaignId) return null;

  const typeRaw = optionalTrimmed(raw, 'type');
  if (typeRaw && typeRaw !== VENUE_CAMPAIGN_PUSH_TYPE) return null;

  return {
    type: VENUE_CAMPAIGN_PUSH_TYPE,
    venueId,
    campaignId,
    venueName: optionalTrimmed(raw, 'venueName'),
    pushCategory: 'partner_marketing',
  };
}

export function parseVenueProximityArrivalPayload(
  raw: Record<string, unknown>,
): VenueProximityArrivalPushPayload | null {
  const typeRaw = optionalTrimmed(raw, 'type');
  if (typeRaw !== VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE) return null;
  const venueId = optionalTrimmed(raw, 'venueId');
  if (!venueId) return null;
  return {
    type: VENUE_PROXIMITY_ARRIVAL_PUSH_TYPE,
    venueId,
    venueName: optionalTrimmed(raw, 'venueName'),
    pushCategory: 'partner_marketing',
  };
}

export function parsePerkExpiryReminderPayload(
  raw: Record<string, unknown>,
): PerkExpiryReminderPushPayload | null {
  if (raw.kind !== PERK_EXPIRY_REMINDER_KIND) return null;
  const venueId = optionalTrimmed(raw, 'venueId');
  const redemptionId = optionalTrimmed(raw, 'redemptionId');
  if (!venueId || !redemptionId) return null;
  return { kind: PERK_EXPIRY_REMINDER_KIND, venueId, redemptionId };
}

export function parseDailyStreakAtRiskPayload(
  raw: Record<string, unknown>,
): DailyStreakAtRiskPushPayload | null {
  if (raw.kind !== DAILY_STREAK_AT_RISK_KIND) return null;
  const scopeKey = optionalTrimmed(raw, 'scopeKey');
  if (!scopeKey) return null;
  const streakRaw = raw.streak;
  const streak =
    typeof streakRaw === 'number'
      ? streakRaw
      : typeof streakRaw === 'string' && streakRaw.trim() !== ''
        ? Number(streakRaw)
        : 0;
  const venueId = optionalTrimmed(raw, 'venueId');
  return {
    kind: DAILY_STREAK_AT_RISK_KIND,
    scopeKey,
    venueId: venueId || undefined,
    streak: Number.isFinite(streak) ? streak : 0,
  };
}
