import type { PortalMeVenueRow } from "./portalApi";

export type VenueStaffRole = PortalMeVenueRow["role"];

const ROLE_RANK: Record<VenueStaffRole, number> = {
  EMPLOYEE: 1,
  MANAGER: 2,
  OWNER: 3,
};

export function isManagementRole(role: VenueStaffRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.MANAGER;
}

export function partnerHasManagementAccess(
  venues: Pick<PortalMeVenueRow, "role">[] | null | undefined,
): boolean {
  if (!venues?.length) return false;
  return venues.some((v) => isManagementRole(v.role));
}

/** Billing / ownership-sensitive portal surfaces — OWNER only. */
export function partnerHasOwnerAccess(
  venues: Pick<PortalMeVenueRow, "role">[] | null | undefined,
): boolean {
  if (!venues?.length) return false;
  return venues.some((v) => v.role === "OWNER");
}

export function venuePortalHomePath(role: VenueStaffRole, venueId: string): string {
  return isManagementRole(role) ? `/owner/venues/${venueId}` : `/staff/${venueId}`;
}

export function partnerNavVenuesActive(pathname: string | null, staffOnly: boolean): boolean {
  if (pathname?.startsWith("/owner/venues")) {
    return (
      !pathname.startsWith("/owner/analytics") &&
      !pathname.startsWith("/owner/subscriptions")
    );
  }
  return staffOnly && Boolean(pathname?.startsWith("/staff/"));
}
