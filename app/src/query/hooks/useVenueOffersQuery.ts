import { useQuery } from '@tanstack/react-query';

import { apiGet } from '../../lib/api';
import { queryKeys } from '../queryKeys';
import { useAuthToken } from '../useAuthToken';

export type VenueOfferRow = {
  id: string;
  title: string;
  body?: string | null;
  fulfillment?: string;
  autoXpMultiplier?: number | null;
  claimStatus?: string | null;
  globallyExhausted?: boolean;
};

export function useVenueOffersQuery(venueId: string | null | undefined) {
  const { isReady, requireToken } = useAuthToken();
  const id = venueId?.trim() || '';

  return useQuery({
    queryKey: queryKeys.venue.offers(id),
    enabled: isReady && id.length > 0,
    queryFn: async () => {
      const token = await requireToken();
      const payload = await apiGet<{ offers: VenueOfferRow[] }>(
        `/venue-context/${encodeURIComponent(id)}/offers`,
        token,
      );
      return Array.isArray(payload.offers) ? payload.offers : [];
    },
  });
}
