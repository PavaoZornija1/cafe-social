const STORAGE_KEY = "cafe-social.portalVenueContext";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPortalVenueContextId(value: string | null | undefined): boolean {
  const v = value?.trim() ?? "";
  return v.length > 0 && UUID_RE.test(v);
}

export function getStoredPortalVenueContext(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  return isPortalVenueContextId(v) ? v : null;
}

export function setStoredPortalVenueContext(venueId: string | null): void {
  if (typeof window === "undefined") return;
  if (venueId == null || venueId === "") {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  if (!isPortalVenueContextId(venueId)) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, venueId);
}

/** Header for `/owner/*` API calls when a super admin is acting in a venue context. */
export function portalVenueContextHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const id = getStoredPortalVenueContext();
  if (!id) return {};
  return { "X-Portal-Venue-Context": id };
}

export const PORTAL_VENUE_CONTEXT_EVENT = "cafe-social-portal-venue-context";

export function dispatchPortalVenueContextChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PORTAL_VENUE_CONTEXT_EVENT));
}
