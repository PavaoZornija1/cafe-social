import { useAuth } from '@clerk/expo';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';

import { apiGet } from '../lib/api';
import { ensureRevenueCatForPlayer, isRevenueCatNativeConfigured, signOutRevenueCat } from '../lib/revenuecat';

type MeSummaryIds = { playerId: string };

/**
 * After Clerk auth, maps RevenueCat's app user id to our Player id (required for server webhooks).
 */
export default function RevenueCatIdentitySync() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || Platform.OS === 'web' || !isRevenueCatNativeConfigured()) return;

    let cancelled = false;

    void (async () => {
      if (!isSignedIn) {
        await signOutRevenueCat();
        return;
      }
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const summary = await apiGet<MeSummaryIds>('/players/me/summary', token);
        if (cancelled) return;
        await ensureRevenueCatForPlayer(summary.playerId);
      } catch {
        // No token yet, network, or onboarding incomplete
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}
