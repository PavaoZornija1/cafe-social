import { apiBase } from "./api";

export type PortalMeVenueRow = {
  role: "EMPLOYEE" | "MANAGER" | "OWNER";
  venue: {
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    address: string | null;
  };
};

export type PortalMeResponse = {
  platformRole: "NONE" | "SUPER_ADMIN";
  playerId: string;
  email: string;
  username: string;
  venues: PortalMeVenueRow[];
};

export async function portalFetch<T>(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers as object),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function fetchPortalMe(
  getToken: () => Promise<string | null>,
): Promise<PortalMeResponse> {
  return portalFetch<PortalMeResponse>(getToken, "/owner/me", { method: "GET" });
}
