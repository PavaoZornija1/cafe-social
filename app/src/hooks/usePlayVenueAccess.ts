import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

import { apiGet } from '../lib/api';
import type { ExplicitCheckInAccess } from '../lib/explicitCheckIn';
import { buildVenueAccessQuery, fetchDetectedVenue } from '../lib/venueDetectClient';

type VenueAccess = ExplicitCheckInAccess & {
  venueId: string;
  canEnterVenueContext: boolean;
  locked?: boolean;
  lockReason?: string | null;
};

type Result = {
  access: VenueAccess | null;
  resolvedVenueId: string | null;
  loading: boolean;
};

/**
 * Resolves venue access for the Play tab — uses route `venueId` when set, else detected venue.
 */
export function usePlayVenueAccess(routeVenueId: string | undefined): Result {
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [access, setAccess] = useState<VenueAccess | null>(null);
  const [resolvedVenueId, setResolvedVenueId] = useState<string | null>(routeVenueId ?? null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setAccess(null);
        setResolvedVenueId(routeVenueId ?? null);
        return;
      }

      let venueId = routeVenueId;
      let coords = null as { lat: number; lng: number } | null;

      if (!venueId) {
        const detected = await fetchDetectedVenue();
        venueId = detected.venue?.id;
        coords = detected.coords;
      } else {
        const detected = await fetchDetectedVenue().catch(() => ({ venue: null, coords: null }));
        coords = detected.coords;
      }

      setResolvedVenueId(venueId ?? null);

      if (!venueId) {
        setAccess(null);
        return;
      }

      const accessQs = buildVenueAccessQuery(coords);
      const a = await apiGet<VenueAccess>(
        `/venue-context/${encodeURIComponent(venueId)}/access${accessQs}`,
        token,
      );
      setAccess(a);
    } catch {
      setAccess(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, routeVenueId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { access, resolvedVenueId, loading };
}
