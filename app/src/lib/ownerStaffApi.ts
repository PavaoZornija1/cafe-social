import { apiGet, apiPost } from './api';

export type OwnerVenueRow = {
  role: 'EMPLOYEE' | 'MANAGER' | 'OWNER';
  venue: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    address: string | null;
  };
};

export type OwnerVenuesResponse = { venues: OwnerVenueRow[] };

export type StaffRedemptionRow = {
  redemptionId: string;
  staffVerificationCode: string;
  playerUsername: string;
  issuedAt: string;
  redeemedAt: string | null;
  expiresAt: string;
  status: string;
  perkCode: string;
  perkTitle: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type StaffRedemptionsResponse = {
  venueId: string;
  venueName: string;
  date: string;
  redemptions: StaffRedemptionRow[];
};

export function fetchOwnerVenues(token: string) {
  return apiGet<OwnerVenuesResponse>('/owner/venues', token);
}

export function fetchStaffRedemptions(token: string, venueId: string, dateYmd: string) {
  const q = new URLSearchParams({ date: dateYmd });
  return apiGet<StaffRedemptionsResponse>(
    `/owner/venues/${encodeURIComponent(venueId)}/redemptions?${q}`,
    token,
  );
}

export function scanAndRedeemStaffReward(
  token: string,
  venueId: string,
  code: string,
) {
  return apiPost<{ ok: true }>(
    `/owner/venues/${encodeURIComponent(venueId)}/redemptions/scan`,
    { code },
    token,
  );
}

export function acknowledgeStaffRedemption(
  token: string,
  venueId: string,
  redemptionId: string,
) {
  return apiPost<{ ok: true }>(
    `/owner/venues/${encodeURIComponent(venueId)}/redemptions/${encodeURIComponent(redemptionId)}/acknowledge`,
    {},
    token,
  );
}

export function lockStaffRedemption(
  token: string,
  venueId: string,
  redemptionId: string,
  reason: string,
) {
  return apiPost<{ ok: true }>(
    `/owner/venues/${encodeURIComponent(venueId)}/redemptions/${encodeURIComponent(redemptionId)}/lock`,
    { reason },
    token,
  );
}

export function unlockStaffRedemption(token: string, venueId: string, redemptionId: string) {
  return apiPost<{ ok: true }>(
    `/owner/venues/${encodeURIComponent(venueId)}/redemptions/${encodeURIComponent(redemptionId)}/unlock`,
    {},
    token,
  );
}

export function voidStaffRedemption(
  token: string,
  venueId: string,
  redemptionId: string,
  reason: string,
) {
  return apiPost<{ ok: true }>(
    `/owner/venues/${encodeURIComponent(venueId)}/redemptions/${encodeURIComponent(redemptionId)}/void`,
    { reason },
    token,
  );
}

export type MemberScanPendingOffer = {
  redemptionId: string;
  offerId: string;
  title: string;
  body: string | null;
  claimedAt: string;
};

export type MemberScanResult = {
  playerId: string;
  username: string;
  visitDayKey: string;
  pendingOffers: MemberScanPendingOffer[];
};

export function scanMemberCardAtVenue(token: string, venueId: string, qrPayload: string) {
  return apiPost<MemberScanResult>(
    `/owner/venues/${encodeURIComponent(venueId)}/member-scan`,
    { qrPayload },
    token,
  );
}

export function fulfillMemberCardOffer(
  token: string,
  venueId: string,
  redemptionId: string,
) {
  return apiPost<{
    redemptionId: string;
    status: string;
    title: string;
    alreadyFulfilled: boolean;
  }>(
    `/owner/venues/${encodeURIComponent(venueId)}/member-scan/fulfill-offer`,
    { redemptionId },
    token,
  );
}

export type StaffModerationSummary = {
  openReportsCount: number;
  activeBansCount: number;
  openAppealsCount: number;
  recentOpenReports: {
    id: string;
    createdAt: string;
    reasonPreview: string;
    reportedUsername: string;
  }[];
};

export function fetchStaffModerationSummary(token: string, venueId: string) {
  return apiGet<StaffModerationSummary>(
    `/owner/venues/${encodeURIComponent(venueId)}/moderation/staff-summary`,
    token,
  );
}

export function utcTodayYmd(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addUtcDaysYmd(ymd: string, delta: number): string {
  const [yy, mm, dd] = ymd.split('-').map((x) => parseInt(x, 10));
  const t = Date.UTC(yy, mm - 1, dd + delta, 12, 0, 0, 0);
  const dt = new Date(t);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
