/** Fields returned by `GET /venue-context/:id/access`. */
export type ExplicitCheckInAccess = {
  requiresExplicitCheckIn?: boolean;
  hasExplicitCheckIn?: boolean;
  bannedFromVenue?: boolean;
  isPhysicallyAtVenue?: boolean;
};

/** Show QR check-in prompt when the venue requires it and the player has not checked in. */
export function needsExplicitCheckInBanner(
  access: ExplicitCheckInAccess | null | undefined,
): boolean {
  if (!access || access.bannedFromVenue) return false;
  return Boolean(access.requiresExplicitCheckIn && !access.hasExplicitCheckIn);
}
