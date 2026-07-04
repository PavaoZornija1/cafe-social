/** Inputs for venue/subscriber “do vs view” rules. */
export type VenueActionAccessInput = {
  subscriptionActive: boolean;
  canEnterVenueContext: boolean;
  playVenueId: string | null;
  venueLocked: boolean;
  /** From venue access — subscriber at geofence without QR still counts for venue-scoped perks/challenges. */
  isPhysicallyAtVenue?: boolean;
  bannedFromVenue?: boolean;
};

/**
 * Whether the player may perform gated actions (play, redeem, claim offers, challenge CTAs).
 * Browse/view paths should not use this.
 */
export function canPerformVenueActions(input: VenueActionAccessInput): boolean {
  if (input.venueLocked || input.bannedFromVenue) return false;
  return input.subscriptionActive || input.canEnterVenueContext;
}

/**
 * Venue id to attach when earning or redeeming venue-scoped rewards.
 * Subscribers physically at a partner venue get that venue even before QR check-in.
 */
export function venueIdForScopedActions(input: VenueActionAccessInput): string | null {
  if (input.venueLocked || input.bannedFromVenue) return null;
  if (input.canEnterVenueContext && input.playVenueId) {
    return input.playVenueId;
  }
  if (
    input.subscriptionActive &&
    input.playVenueId &&
    input.isPhysicallyAtVenue === true
  ) {
    return input.playVenueId;
  }
  return null;
}

export function buildVenueActionAccess(input: VenueActionAccessInput) {
  return {
    canDoVenueActions: canPerformVenueActions(input),
    venueScopedId: venueIdForScopedActions(input),
  };
}
