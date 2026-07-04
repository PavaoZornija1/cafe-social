import { useQuery } from '@tanstack/react-query';

import { apiGet } from '../../lib/api';
import { queryKeys } from '../queryKeys';

export type VenuePublicCardDto = {
  id: string;
  name: string;
  menuUrl: string | null;
  orderingUrl: string | null;
  offers: unknown[];
  featuredOffer: {
    id: string;
    title: string | null;
    body: string | null;
    endsAt?: string | null;
  } | null;
  geofence?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  requiresExplicitCheckIn?: boolean;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  region?: string | null;
};

export function useVenuePublicCardQuery(venueId: string | null | undefined) {
  const id = venueId?.trim() || '';

  return useQuery({
    queryKey: queryKeys.venue.publicCard(id),
    enabled: id.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const card = await apiGet<VenuePublicCardDto>(
        `/venues/${encodeURIComponent(id)}/public-card`,
      );
      return {
        ...card,
        offers: Array.isArray(card.offers) ? card.offers : [],
      };
    },
  });
}
