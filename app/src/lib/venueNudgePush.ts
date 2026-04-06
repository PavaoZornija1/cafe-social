/**
 * Partner marketing pushes for venue “nudges” (dwell timer + optional admin trigger).
 * Payload `data` is stringified by Expo; always normalize with these helpers.
 */

export const VENUE_ORDER_NUDGE_PUSH_TYPE = 'venue_order_nudge' as const;

export type VenueNudgePushTrigger = 'dwell' | 'admin';

export type VenueOrderNudgePushPayload = {
  type: typeof VENUE_ORDER_NUDGE_PUSH_TYPE;
  venueId: string;
  pushCategory: 'partner_marketing';
  trigger: VenueNudgePushTrigger;
  /** Present when the server resolved a specific `VenueNudgeAssignment`. */
  assignmentId?: string;
  /** `VenueOrderNudgeTemplate.code` when available. */
  templateCode?: string;
  /** Analytics bucket from the template. */
  nudgeType?: string;
  orderingUrl: string;
  menuUrl: string;
};

function readString(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === 'string' ? v : '';
}

function optionalTrimmed(raw: Record<string, unknown>, key: string): string | undefined {
  const s = readString(raw, key).trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Returns a typed payload when `raw` is a venue order nudge notification, else `null`.
 */
export function parseVenueOrderNudgePayload(
  raw: Record<string, unknown>,
): VenueOrderNudgePushPayload | null {
  if (raw.type !== VENUE_ORDER_NUDGE_PUSH_TYPE) return null;

  const venueId = optionalTrimmed(raw, 'venueId');
  if (!venueId) return null;

  const triggerRaw = optionalTrimmed(raw, 'trigger') ?? 'dwell';
  const trigger: VenueNudgePushTrigger =
    triggerRaw === 'admin' ? 'admin' : 'dwell';

  return {
    type: VENUE_ORDER_NUDGE_PUSH_TYPE,
    venueId,
    pushCategory: 'partner_marketing',
    trigger,
    assignmentId: optionalTrimmed(raw, 'assignmentId'),
    templateCode: optionalTrimmed(raw, 'templateCode'),
    nudgeType: optionalTrimmed(raw, 'nudgeType'),
    orderingUrl: readString(raw, 'orderingUrl'),
    menuUrl: readString(raw, 'menuUrl'),
  };
}
