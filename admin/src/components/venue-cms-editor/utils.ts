import type { VenueCmsSectionKey } from "./types";

export function venueCmsBasePath(venueId: string): string {
  return `/venues/${venueId}`;
}

export function venueCmsSectionPath(
  venueId: string,
  section: VenueCmsSectionKey,
): string {
  if (section === "settings") return venueCmsBasePath(venueId);
  return `${venueCmsBasePath(venueId)}/${section}`;
}
