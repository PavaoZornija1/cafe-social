/** Matches backend `PARTNER_TRIAL_LOCK_REASON`. */
export const PARTNER_TRIAL_LOCK_REASON = 'AUTO_TRIAL_EXPIRED';

export type VenueLockFields = {
  locked?: boolean;
  lockReason?: string | null;
};

export function isVenuePartnerLocked(
  access: VenueLockFields | null | undefined,
): boolean {
  return Boolean(access?.locked);
}

/** Short lock copy for banners and play cards (locked venues are otherwise hidden). */
export function venueLockMessageKey(
  access: VenueLockFields | null | undefined,
): 'home.venueTrialEndedShort' | 'home.venueTemporarilyUnavailableShort' | null {
  if (!access?.locked) return null;
  if (access.lockReason === PARTNER_TRIAL_LOCK_REASON) {
    return 'home.venueTrialEndedShort';
  }
  return 'home.venueTemporarilyUnavailableShort';
}
