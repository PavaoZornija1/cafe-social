import { useQuery } from '@tanstack/react-query';

import { apiGet } from '../../lib/api';
import type { ExplicitCheckInAccess } from '../../lib/explicitCheckIn';
import type { Coordinates } from '../../lib/locationForDetect';
import { buildVenueAccessQuery } from '../../lib/venueDetectClient';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export type VenueAccessDto = ExplicitCheckInAccess & {
  venueId: string;
  canEnterVenueContext: boolean;
  isPremium?: boolean;
  visitedBefore?: boolean;
  subscriptionActive?: boolean;
  locked?: boolean;
  lockReason?: string | null;
  staffRole?: 'EMPLOYEE' | 'MANAGER' | 'OWNER' | null;
  canClaimGuestRewards?: boolean;
  canUseStaffTools?: boolean;
};

export function useVenueAccessQuery(
  venueId: string | null | undefined,
  coords: Coordinates | null | undefined,
) {
  const { isReady, requireToken } = useAuthToken();
  const id = venueId?.trim() || '';
  const coordsKey = coords ?? null;

  return useQuery({
    queryKey: queryKeys.venue.access(id, coordsKey),
    enabled: isReady && id.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<VenueAccessDto> => {
      const token = await requireToken();
      const accessQs = buildVenueAccessQuery(coordsKey);
      return apiGet<VenueAccessDto>(
        `/venue-context/${encodeURIComponent(id)}/access${accessQs}`,
        token,
      );
    },
  });
}
