import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import {
  fetchDetectedVenue,
  type VenueDetectResult,
} from '../../lib/venueDetectClient';
import { queryKeys } from '../queryKeys';

/**
 * Geofence detect (GPS + `/venue-context/detect`). Shared across Home, Play, presence.
 * No auth required for detect itself.
 */
export function useDetectedVenueQuery(options?: { refetchOnScreenFocus?: boolean }) {
  const refetchOnScreenFocus = options?.refetchOnScreenFocus ?? true;

  const query = useQuery({
    queryKey: queryKeys.venue.detect(),
    staleTime: 20_000,
    queryFn: async (): Promise<VenueDetectResult> => fetchDetectedVenue(),
  });

  useFocusEffect(
    useCallback(() => {
      if (!refetchOnScreenFocus) return;
      void query.refetch();
    }, [refetchOnScreenFocus, query.refetch]),
  );

  return query;
}
