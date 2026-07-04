import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { ensureBackgroundApiToken } from '../lib/backgroundTokenSync';
import { setBackgroundApiToken } from '../lib/backgroundApiToken';

/**
 * Issues / refreshes the long-lived background geofence token while signed in.
 */
export function BackgroundTokenSyncEffect() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      void setBackgroundApiToken(null);
      return;
    }

    let cancelled = false;

    async function sync() {
      if (cancelled) return;
      try {
        await ensureBackgroundApiToken(() => getTokenRef.current());
      } catch {
        /* non-blocking */
      }
    }

    void sync();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') void sync();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
