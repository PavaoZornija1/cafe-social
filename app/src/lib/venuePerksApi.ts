import { apiGet } from './api';

export type VenuePerkPublicTeaser = {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  requiresQrUnlock: boolean;
  fullyRedeemed: boolean;
  redeemedByYou: boolean;
};

export type VenueRedeemableReward = {
  redemptionId: string;
  perkId: string;
  perkCode: string;
  perkTitle: string;
  perkSubtitle: string | null;
  status: string;
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
  staffVerificationCode: string;
  qrPayload: string;
};

export function fetchVenuePerkTeasers(
  venueId: string,
  token: string,
): Promise<VenuePerkPublicTeaser[]> {
  return apiGet<VenuePerkPublicTeaser[]>(
    `/venue-context/${encodeURIComponent(venueId)}/perks`,
    token,
  );
}

export function fetchMyVenueRewards(
  venueId: string,
  token: string,
): Promise<VenueRedeemableReward[]> {
  return apiGet<VenueRedeemableReward[]>(
    `/venue-context/${encodeURIComponent(venueId)}/perks/my-rewards`,
    token,
  );
}

/** Cross-venue reward claims (`GET /players/me/reward-claims`). */
export type GlobalRewardClaim = VenueRedeemableReward & {
  venueId: string;
  venueName: string;
};

export type GlobalRewardClaimsPayload = {
  wallet: { activeRedeemable: number };
  items: GlobalRewardClaim[];
};

export function fetchMyGlobalRewardClaims(
  token: string,
): Promise<GlobalRewardClaimsPayload> {
  return apiGet<GlobalRewardClaimsPayload>('/players/me/reward-claims', token);
}
