export function todayUtc(): string {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function venueDashboardBasePath(venueId: string): string {
  return `/owner/venues/${venueId}`;
}

export function venueDashboardSectionPath(
  venueId: string,
  section: string,
): string {
  if (section === "playbook") return venueDashboardBasePath(venueId);
  return `${venueDashboardBasePath(venueId)}/${section}`;
}
