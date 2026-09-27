import { apiBase } from "./api";

export type SubmitPartnerApplicationPayload = {
  applicantEmail: string;
  applicantName: string;
  applicantPhone?: string;
  venueName: string;
  address: string;
  city: string;
  country: string;
};

export type SubmitPartnerApplicationResult = {
  id: string;
  status: "PENDING";
};

function parseApiError(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.filter(Boolean).join("; ");
  } catch {
    /* not JSON */
  }
  return text?.trim() || fallback;
}

export async function submitPartnerApplication(
  payload: SubmitPartnerApplicationPayload,
): Promise<SubmitPartnerApplicationResult> {
  const res = await fetch(`${apiBase()}/partner-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, res.statusText));
  }
  return JSON.parse(text) as SubmitPartnerApplicationResult;
}

export type AdminPartnerApplicationListItem = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  applicantEmail: string;
  applicantName: string;
  applicantPhone: string | null;
  venueName: string;
  city: string;
  country: string;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminPartnerApplicationDetail = AdminPartnerApplicationListItem & {
  address: string;
  latitude: number | null;
  longitude: number | null;
  geofencePolygon: Record<string, unknown> | null;
  locationKind: "SINGLE_LOCATION" | "MULTI_LOCATION" | null;
  organizationName: string | null;
  analyticsTimeZone: string | null;
  rejectionReason: string | null;
  createdOrganizationId: string | null;
  createdVenueId: string | null;
};

export type ApprovePartnerApplicationPayload = {
  latitude: number;
  longitude: number;
  geofencePolygon: Record<string, unknown>;
  organizationName?: string;
  locationKind?: "SINGLE_LOCATION" | "MULTI_LOCATION";
  venueName?: string;
  analyticsTimeZone?: string;
};
