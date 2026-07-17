/**
 * Pure policy helpers for venue-scoped staff reward restrictions.
 *
 * Staff (EMPLOYEE / MANAGER / OWNER) at their own venue may SEE offers,
 * perks, challenges, and existing rewards, but may not claim / redeem /
 * submit / verify guest rewards there. At any other venue they get the
 * full guest flow.
 */

export type OfferPolicyInput = {
  fulfillment?: 'AUTO' | 'MEMBER_CARD';
  claimStatus?: 'NONE' | 'PENDING' | 'FULFILLED' | null;
  globallyExhausted?: boolean;
  autoXpMultiplier?: number | null;
};

export type OfferCta =
  | { kind: 'claim' }
  | { kind: 'showMemberCard' }
  | { kind: 'fulfilled' }
  | { kind: 'exhausted' }
  | { kind: 'staffUnavailable' }
  | { kind: 'autoInfo'; boosted: boolean };

/**
 * Decide the CTA for a venue offer.
 * When `guestClaimsEnabled` is false (staff at their own venue), every
 * MEMBER_CARD state — including a pre-existing PENDING claim — resolves to
 * `staffUnavailable`, except FULFILLED which stays informational. AUTO
 * offers stay visible but never advertise an XP boost to staff, since
 * AUTO XP is excluded backend-side for staff accounts.
 */
export function resolveOfferCta(
  offer: OfferPolicyInput,
  guestClaimsEnabled: boolean,
): OfferCta {
  if (offer.fulfillment === 'AUTO') {
    const boosted =
      guestClaimsEnabled && (offer.autoXpMultiplier ?? 0) > 1;
    return { kind: 'autoInfo', boosted };
  }
  if (offer.claimStatus === 'FULFILLED') return { kind: 'fulfilled' };
  if (!guestClaimsEnabled) return { kind: 'staffUnavailable' };
  if (offer.claimStatus === 'PENDING') return { kind: 'showMemberCard' };
  if (offer.globallyExhausted) return { kind: 'exhausted' };
  return { kind: 'claim' };
}

export type AutoXpOfferInput = {
  /** Loose string: API rows are not always narrowed to the union. */
  fulfillment?: string;
  autoXpMultiplier?: number | null;
};

/**
 * Highest AUTO XP multiplier that may be advertised to the user.
 * Own-venue staff (`guestClaimsEnabled` false) always see 1× because AUTO
 * XP is stripped for staff accounts backend-side.
 */
export function displayedAutoXpMultiplier(
  offers: readonly AutoXpOfferInput[],
  guestClaimsEnabled: boolean,
): number {
  if (!guestClaimsEnabled) return 1;
  return Math.max(
    1,
    ...offers
      .filter((o) => o.fulfillment === 'AUTO' && (o.autoXpMultiplier ?? 0) > 1)
      .map((o) => o.autoXpMultiplier ?? 1),
  );
}

/** Whether tapping the offer should do anything at all. */
export function isOfferCtaActionable(cta: OfferCta): boolean {
  switch (cta.kind) {
    case 'claim':
    case 'showMemberCard':
    case 'autoInfo':
      return true;
    case 'fulfilled':
    case 'exhausted':
    case 'staffUnavailable':
      return false;
    default: {
      const _exhaustive: never = cta;
      return _exhaustive;
    }
  }
}

export type GuestRewardActionInput = {
  /** Venue ids where the user holds any staff role. */
  staffVenueIds: readonly string[];
  /** True once the staff memberships query has resolved. */
  membershipsResolved: boolean;
  /** Venue the reward / action belongs to; null when unknown. */
  rewardVenueId: string | null | undefined;
};

/**
 * Per-reward/venue guest action gate: staff at venue A must not redeem,
 * show codes/QRs, or submit receipts for rewards at A, but keep the full
 * guest flow for rewards at venue B. While memberships are unresolved,
 * actions stay hidden to avoid flashing claimable state to staff.
 * Fail-safe: an unknown/blank reward venue is only allowed for users with
 * no staff memberships at all — it could be any staff member's own venue.
 */
export function canUseGuestRewardActionsAtVenue(
  input: GuestRewardActionInput,
): boolean {
  if (!input.membershipsResolved) return false;
  const venueId = input.rewardVenueId?.trim();
  if (!venueId) return input.staffVenueIds.length === 0;
  return !input.staffVenueIds.includes(venueId);
}

export type GuestClaimsEnabledInput = {
  /** Backend per-venue access flag when available. */
  accessCanClaimGuestRewards: boolean | undefined;
  /** True once the staff memberships query has resolved. */
  membershipsResolved: boolean;
  /** Staff membership match for the active venue from any resolved source. */
  isStaffAtVenue: boolean;
};

/**
 * Loading-safe resolution of "can this user act as a guest here".
 * Priority: explicit backend access flag → known staff membership (deny)
 * → deny while unresolved → allow once resolved as non-staff.
 */
export function resolveGuestClaimsEnabled(
  input: GuestClaimsEnabledInput,
): boolean {
  if (typeof input.accessCanClaimGuestRewards === 'boolean') {
    return input.accessCanClaimGuestRewards;
  }
  if (input.isStaffAtVenue) return false;
  return input.membershipsResolved;
}

export type MemberCardQrVisibility =
  | 'visible'
  | 'hiddenStaffVenue'
  | 'hiddenResolving';

/**
 * Whether the member card QR may render. Fail-safe: with an active venue,
 * the QR stays hidden until staff state resolves so own-venue staff never
 * see a usable QR flash. While venue detection is still pending, only users
 * with known staff memberships are held back — guests (and offline use of
 * the cached card, where detection settles quickly) keep the QR available.
 */
export function memberCardQrVisibility(input: {
  activeVenueId: string | null | undefined;
  isStaffAtVenue: boolean;
  staffStateResolved: boolean;
  /** True while venue detection has not produced a result yet. */
  venueDetectionPending?: boolean;
  /** True when the user holds any staff membership. */
  hasStaffVenues?: boolean;
}): MemberCardQrVisibility {
  if (!input.activeVenueId) {
    if (input.venueDetectionPending && input.hasStaffVenues) {
      return 'hiddenResolving';
    }
    return 'visible';
  }
  if (input.isStaffAtVenue) return 'hiddenStaffVenue';
  if (!input.staffStateResolved) return 'hiddenResolving';
  return 'visible';
}

export type MemberCardVenueMode = 'guest' | 'staffOwnVenue';

/**
 * How the global Member Card screen should present itself for the
 * currently active/detected venue. The card stays accessible everywhere;
 * at the user's own workplace it must warn that it is not valid there.
 */
export function memberCardVenueMode(input: {
  activeVenueId: string | null | undefined;
  isStaffAtVenue: boolean;
}): MemberCardVenueMode {
  if (input.activeVenueId && input.isStaffAtVenue) return 'staffOwnVenue';
  return 'guest';
}
