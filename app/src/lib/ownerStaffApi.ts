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
