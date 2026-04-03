/** Venues auto-locked when partner trial ends without payment. */
export const PARTNER_TRIAL_LOCK_REASON = 'AUTO_TRIAL_EXPIRED';

export const PARTNER_TRIAL_DAYS = 14;

/** Max self-serve orgs a player may create per rolling 24h window. */
export const MAX_SELF_SERVE_ORGS_PER_24H = 5;

export function isPayingPartnerOrg(platformBillingStatus: string): boolean {
  const s = platformBillingStatus?.trim().toUpperCase() ?? 'NONE';
  return (
    s === 'ACTIVE' ||
    s === 'ACTIVE_CANCELING' ||
    s === 'TRIALING' ||
    s === 'PAST_DUE'
  );
}
