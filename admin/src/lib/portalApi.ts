import { apiBase } from "./api";
import {
  getStoredPortalVenueContext,
  portalVenueContextHeaders,
  setStoredPortalVenueContext,
} from "./portalVenueContext";

export type PortalMeOrg = {
  id: string;
  name: string;
  slug: string | null;
  locationKind: "SINGLE_LOCATION" | "MULTI_LOCATION";
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  platformBillingPlan: string | null;
  platformBillingStatus: string;
  platformBillingRenewsAt: string | null;
  platformBillingSyncedAt: string | null;
  billingPortalUrl: string | null;
};

export type PortalMeVenueRow = {
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  venue: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    address: string | null;
    organizationId: string | null;
    locked: boolean;
    lockReason: string | null;
    organization: PortalMeOrg | null;
  };
};

export type PortalMeResponse = {
  platformRole: "NONE" | "SUPER_ADMIN";
  playerId: string;
  email: string;
  username: string;
  venues: PortalMeVenueRow[];
  /** True when the user should complete self-serve partner onboarding (no pending staff invites). */
  needsPartnerOnboarding: boolean;
  /** Super admin: echoed from `X-Portal-Venue-Context` when valid (partner acting mode). */
  actingPartnerVenueId?: string | null;
};

export type PartnerOnboardingPayload = {
  locationKind: "SINGLE_LOCATION" | "MULTI_LOCATION";
  organizationName: string;
  venueName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address?: string;
  city?: string;
  country?: string;
  analyticsTimeZone?: string;
};

export type PartnerOnboardingResult = {
  organizationId: string;
  venueId: string;
  trialEndsAt: string;
  locationKind: string;
};

function parseApiErrorBody(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as {
      message?: string | string[];
      error?: string;
    };
    if (typeof j.message === "string") return j.message;
    if (Array.isArray(j.message)) return j.message.filter(Boolean).join("; ");
    if (typeof j.error === "string") return j.error;
  } catch {
    /* not JSON */
  }
  return text?.trim() || fallback;
}

export async function portalFetch<T>(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  const ownerContext = path.startsWith("/owner")
    ? portalVenueContextHeaders()
    : {};
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...ownerContext,
      ...(init?.headers as object),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiErrorBody(text, res.statusText));
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function fetchPortalMe(
  getToken: () => Promise<string | null>,
): Promise<PortalMeResponse> {
  const me = await portalFetch<PortalMeResponse>(getToken, "/owner/me", {
    method: "GET",
  });
  if (me.platformRole === "SUPER_ADMIN") {
    const server = me.actingPartnerVenueId ?? null;
    const local = getStoredPortalVenueContext();
    if (server !== local) {
      setStoredPortalVenueContext(server);
    }
  }
  return me;
}

/** Raw fetch to `/owner/*` with auth + optional super-admin venue context header. */
export async function ownerFetch(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...portalVenueContextHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  };
  const body = init?.body;
  if (body !== undefined && typeof body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
  });
}

/** Parse JSON from an `/owner/*` response; throws on non-OK (for TanStack Query). */
export async function ownerJson<T>(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await ownerFetch(getToken, path, init ?? { method: "GET" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text?.trim() || res.statusText);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function partnerOnboardingBootstrap(
  getToken: () => Promise<string | null>,
  body: PartnerOnboardingPayload,
): Promise<PartnerOnboardingResult> {
  return portalFetch<PartnerOnboardingResult>(getToken, "/owner/onboarding/bootstrap", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
