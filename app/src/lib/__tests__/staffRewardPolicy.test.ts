import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canUseGuestRewardActionsAtVenue,
  displayedAutoXpMultiplier,
  isOfferCtaActionable,
  memberCardQrVisibility,
  memberCardVenueMode,
  resolveGuestClaimsEnabled,
  resolveOfferCta,
} from '../staffRewardPolicy.ts';

describe('resolveOfferCta', () => {
  it('lets guests claim an unclaimed member-card offer', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'MEMBER_CARD', claimStatus: 'NONE' }, true),
      { kind: 'claim' },
    );
  });

  it('points guests with a pending claim to the member card', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'MEMBER_CARD', claimStatus: 'PENDING' }, true),
      { kind: 'showMemberCard' },
    );
  });

  it('marks fulfilled offers as fulfilled for everyone', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'MEMBER_CARD', claimStatus: 'FULFILLED' }, false),
      { kind: 'fulfilled' },
    );
  });

  it('shows exhausted for globally exhausted unclaimed offers', () => {
    assert.deepEqual(
      resolveOfferCta(
        { fulfillment: 'MEMBER_CARD', claimStatus: 'NONE', globallyExhausted: true },
        true,
      ),
      { kind: 'exhausted' },
    );
  });

  it('blocks own-venue staff from claiming, including NONE state', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'MEMBER_CARD', claimStatus: 'NONE' }, false),
      { kind: 'staffUnavailable' },
    );
  });

  it('blocks own-venue staff even for pre-existing PENDING claims', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'MEMBER_CARD', claimStatus: 'PENDING' }, false),
      { kind: 'staffUnavailable' },
    );
  });

  it('shows guests the auto XP boost when a multiplier is active', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'AUTO', autoXpMultiplier: 2 }, true),
      { kind: 'autoInfo', boosted: true },
    );
  });

  it('never implies an XP boost for own-venue staff on AUTO offers', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'AUTO', autoXpMultiplier: 2 }, false),
      { kind: 'autoInfo', boosted: false },
    );
  });

  it('treats an AUTO offer without multiplier as unboosted for guests', () => {
    assert.deepEqual(
      resolveOfferCta({ fulfillment: 'AUTO', autoXpMultiplier: null }, true),
      { kind: 'autoInfo', boosted: false },
    );
  });
});

describe('isOfferCtaActionable', () => {
  it('claim / showMemberCard / autoInfo are actionable', () => {
    assert.equal(isOfferCtaActionable({ kind: 'claim' }), true);
    assert.equal(isOfferCtaActionable({ kind: 'showMemberCard' }), true);
    assert.equal(isOfferCtaActionable({ kind: 'autoInfo', boosted: false }), true);
  });

  it('fulfilled / exhausted / staffUnavailable are not actionable', () => {
    assert.equal(isOfferCtaActionable({ kind: 'fulfilled' }), false);
    assert.equal(isOfferCtaActionable({ kind: 'exhausted' }), false);
    assert.equal(isOfferCtaActionable({ kind: 'staffUnavailable' }), false);
  });
});

describe('canUseGuestRewardActionsAtVenue', () => {
  const staffVenueIds = ['venue-a'];

  it('blocks staff for rewards at their own venue', () => {
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds,
        membershipsResolved: true,
        rewardVenueId: 'venue-a',
      }),
      false,
    );
  });

  it('allows staff of venue A to act on rewards at venue B', () => {
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds,
        membershipsResolved: true,
        rewardVenueId: 'venue-b',
      }),
      true,
    );
  });

  it('allows non-staff users everywhere', () => {
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds: [],
        membershipsResolved: true,
        rewardVenueId: 'venue-a',
      }),
      true,
    );
  });

  it('does not expose actions while memberships are unresolved', () => {
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds: [],
        membershipsResolved: false,
        rewardVenueId: 'venue-a',
      }),
      false,
    );
  });

  it('fails safe for an unknown reward venue when the user has any staff membership', () => {
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds,
        membershipsResolved: true,
        rewardVenueId: null,
      }),
      false,
    );
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds,
        membershipsResolved: true,
        rewardVenueId: '   ',
      }),
      false,
    );
  });

  it('allows an unknown reward venue for users with no staff memberships once resolved', () => {
    assert.equal(
      canUseGuestRewardActionsAtVenue({
        staffVenueIds: [],
        membershipsResolved: true,
        rewardVenueId: null,
      }),
      true,
    );
  });
});

describe('displayedAutoXpMultiplier', () => {
  const offers = [
    { fulfillment: 'AUTO' as const, autoXpMultiplier: 2 },
    { fulfillment: 'AUTO' as const, autoXpMultiplier: 3 },
    { fulfillment: 'MEMBER_CARD' as const, autoXpMultiplier: 5 },
    { fulfillment: 'AUTO' as const, autoXpMultiplier: null },
  ];

  it('returns the highest active AUTO multiplier for guests', () => {
    assert.equal(displayedAutoXpMultiplier(offers, true), 3);
  });

  it('ignores non-AUTO offers even with a multiplier set', () => {
    assert.equal(
      displayedAutoXpMultiplier(
        [{ fulfillment: 'MEMBER_CARD' as const, autoXpMultiplier: 4 }],
        true,
      ),
      1,
    );
  });

  it('returns 1 when no offer boosts XP', () => {
    assert.equal(
      displayedAutoXpMultiplier(
        [{ fulfillment: 'AUTO' as const, autoXpMultiplier: 1 }],
        true,
      ),
      1,
    );
    assert.equal(displayedAutoXpMultiplier([], true), 1);
  });

  it('never advertises a boost to own-venue staff', () => {
    assert.equal(displayedAutoXpMultiplier(offers, false), 1);
  });
});

describe('memberCardQrVisibility', () => {
  it('hides pre-detection for users with staff memberships', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: null,
        venueDetectionPending: true,
        hasStaffVenues: true,
        isStaffAtVenue: false,
        staffStateResolved: true,
      }),
      'hiddenResolving',
    );
  });

  it('stays visible pre-detection for users with no staff memberships', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: null,
        venueDetectionPending: true,
        hasStaffVenues: false,
        isStaffAtVenue: false,
        staffStateResolved: true,
      }),
      'visible',
    );
  });

  it('is visible when no venue is active (incl. offline use)', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: null,
        isStaffAtVenue: false,
        staffStateResolved: false,
      }),
      'visible',
    );
  });

  it('hides the QR for staff at their own venue', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: 'venue-a',
        isStaffAtVenue: true,
        staffStateResolved: true,
      }),
      'hiddenStaffVenue',
    );
  });

  it('hides the QR while staff state at an active venue is unresolved', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: 'venue-a',
        isStaffAtVenue: false,
        staffStateResolved: false,
      }),
      'hiddenResolving',
    );
  });

  it('hides for staff even before full resolution when a staff signal exists', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: 'venue-a',
        isStaffAtVenue: true,
        staffStateResolved: false,
      }),
      'hiddenStaffVenue',
    );
  });

  it('is visible for resolved guests at a venue', () => {
    assert.equal(
      memberCardQrVisibility({
        activeVenueId: 'venue-b',
        isStaffAtVenue: false,
        staffStateResolved: true,
      }),
      'visible',
    );
  });
});

describe('resolveGuestClaimsEnabled', () => {
  it('trusts an explicit backend access flag', () => {
    assert.equal(
      resolveGuestClaimsEnabled({
        accessCanClaimGuestRewards: false,
        membershipsResolved: false,
        isStaffAtVenue: false,
      }),
      false,
    );
    assert.equal(
      resolveGuestClaimsEnabled({
        accessCanClaimGuestRewards: true,
        membershipsResolved: false,
        isStaffAtVenue: true,
      }),
      true,
    );
  });

  it('denies staff at venue even before access resolves', () => {
    assert.equal(
      resolveGuestClaimsEnabled({
        accessCanClaimGuestRewards: undefined,
        membershipsResolved: false,
        isStaffAtVenue: true,
      }),
      false,
    );
  });

  it('does not enable guest claims while staff state is unresolved', () => {
    assert.equal(
      resolveGuestClaimsEnabled({
        accessCanClaimGuestRewards: undefined,
        membershipsResolved: false,
        isStaffAtVenue: false,
      }),
      false,
    );
  });

  it('enables guest claims once memberships resolve to non-staff', () => {
    assert.equal(
      resolveGuestClaimsEnabled({
        accessCanClaimGuestRewards: undefined,
        membershipsResolved: true,
        isStaffAtVenue: false,
      }),
      true,
    );
  });
});

describe('memberCardVenueMode', () => {
  it('is guest when no venue is active', () => {
    assert.equal(
      memberCardVenueMode({ activeVenueId: null, isStaffAtVenue: false }),
      'guest',
    );
  });

  it('is staffOwnVenue when staff at the active venue', () => {
    assert.equal(
      memberCardVenueMode({ activeVenueId: 'venue-a', isStaffAtVenue: true }),
      'staffOwnVenue',
    );
  });

  it('is guest at venues where the user is not staff', () => {
    assert.equal(
      memberCardVenueMode({ activeVenueId: 'venue-b', isStaffAtVenue: false }),
      'guest',
    );
  });
});
