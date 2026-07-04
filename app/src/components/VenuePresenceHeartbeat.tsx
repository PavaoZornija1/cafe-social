import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { apiPost } from '../lib/api';
import { useDetectedVenueQuery } from '../query';

/**
 * Periodically re-posts geofence venue presence while signed in.
 * Uses the shared detect query so Home / Play / heartbeat stay aligned.
 */
const INTERVAL_MS = 5 * 60 * 1000;

export function VenuePresenceHeartbeat() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const detect = useDetectedVenueQuery({ refetchOnScreenFocus: false });
  const refetchDetect = detect.refetch;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function ping() {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const result = await refetchDetect();
        const venueId = result.data?.venue?.id ?? null;
        await apiPost('/social/me/presence', { venueId }, token);
      } catch {
        /* non-blocking */
      }
    }

    void ping();
    const id = setInterval(() => void ping(), INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void ping();
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isLoaded, isSignedIn, refetchDetect]);

  return null;
}
