import { useMemo } from 'react';

import type { VenueStaffRole } from '../../lib/staffContext';
import { isManagerPlusRole } from '../../lib/staffContext';
import { useStaffVenuesQuery } from './useStaffVenuesQuery';
import { useVenueSession } from './useVenueSession';

export type StaffContext = {
  staffVenues: ReturnType<typeof useStaffVenuesQuery>['data'];
  hasStaffVenues: boolean;
  roleAtVenue: VenueStaffRole | null;
  isStaffAtVenue: boolean;
  isManagerPlus: boolean;
  isOwner: boolean;
  canClaimGuestRewards: boolean;
  canUseStaffTools: boolean;
  isLoading: boolean;
};

/**
 * Central staff role context for the active or routed venue.
 * Combines cached staff memberships with per-venue access flags from the backend.
 */
export function useStaffContext(options?: { venueId?: string | null }): StaffContext {
  const routeVenueId = options?.venueId?.trim() || undefined;
  const session = useVenueSession({ routeVenueId, refetchOnScreenFocus: false });
  const staffQuery = useStaffVenuesQuery();

  const activeVenueId = routeVenueId ?? session.playVenueId;
  const staffVenues = staffQuery.data ?? [];

  const roleAtVenue = useMemo((): VenueStaffRole | null => {
    if (!activeVenueId) return null;
    const fromMembership = staffVenues.find((row) => row.venue.id === activeVenueId)?.role;
    if (fromMembership) return fromMembership;
    const fromAccess = session.access?.staffRole;
    return fromAccess ?? null;
  }, [activeVenueId, staffVenues, session.access?.staffRole]);

  const isStaffAtVenue = roleAtVenue != null;
  const canClaimGuestRewards =
    session.access?.canClaimGuestRewards ?? !isStaffAtVenue;
  const canUseStaffTools =
    session.access?.canUseStaffTools ?? isStaffAtVenue;

  return useMemo(
    () => ({
      staffVenues,
      hasStaffVenues: staffVenues.length > 0,
      roleAtVenue,
      isStaffAtVenue,
      isManagerPlus: isManagerPlusRole(roleAtVenue),
      isOwner: roleAtVenue === 'OWNER',
      canClaimGuestRewards,
      canUseStaffTools,
      isLoading: staffQuery.isLoading,
    }),
    [
      staffVenues,
      roleAtVenue,
      isStaffAtVenue,
      canClaimGuestRewards,
      canUseStaffTools,
      staffQuery.isLoading,
    ],
  );
}
