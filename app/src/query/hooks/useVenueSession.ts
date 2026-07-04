import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { needsExplicitCheckInBanner } from '../../lib/explicitCheckIn';
import { isVenuePartnerLocked, venueLockMessageKey } from '../../lib/venueLock';
import { invalidateVenueSession } from '../invalidateVenueSession';
import { useDetectedVenueQuery } from './useDetectedVenueQuery';
import { useVenueAccessQuery } from './useVenueAccessQuery';

export type UseVenueSessionOptions = {
  /** Explicit venue (hub / challenges). When omitted, uses geofence detect. */
  routeVenueId?: string | null;
  refetchOnScreenFocus?: boolean;
};

/**
 * Single source of truth for “which venue am I at / can I play”.
 * Prefer this over per-screen detect + access fetches.
 */
export function useVenueSession(options?: UseVenueSessionOptions) {
  const routeVenueId = options?.routeVenueId?.trim() || undefined;
  const detect = useDetectedVenueQuery({
    refetchOnScreenFocus: options?.refetchOnScreenFocus,
  });
  const queryClient = useQueryClient();

  const playVenueId = routeVenueId ?? detect.data?.venue?.id ?? null;
  const coords = detect.data?.coords ?? null;

  const accessQuery = useVenueAccessQuery(playVenueId, coords);

  const access = accessQuery.data ?? null;
  const detectedVenue = detect.data?.venue ?? null;

  const showCheckIn = needsExplicitCheckInBanner(access);
  const venueLocked =
    isVenuePartnerLocked(access) || Boolean(detectedVenue?.locked && !routeVenueId);
  const venueLockKey = venueLockMessageKey(
    access?.locked ? access : detectedVenue?.locked ? { locked: true } : null,
  );
  const playBlocked = showCheckIn || venueLocked;
  const canEnterVenueContext = Boolean(
    playVenueId && access?.canEnterVenueContext && !venueLocked,
  );

  const isLoading =
    detect.isLoading || (Boolean(playVenueId) && accessQuery.isLoading);
  const isFetching = detect.isFetching || accessQuery.isFetching;

  const refetch = useCallback(async () => {
    await detect.refetch();
    if (playVenueId) await accessQuery.refetch();
  }, [detect, accessQuery, playVenueId]);

  const invalidate = useCallback(async () => {
    await invalidateVenueSession(queryClient, playVenueId);
  }, [queryClient, playVenueId]);

  return useMemo(
    () => ({
      playVenueId,
      routeVenueId: routeVenueId ?? null,
      detectedVenue,
      coords,
      access,
      showCheckIn,
      venueLocked,
      venueLockKey,
      playBlocked,
      canEnterVenueContext,
      isLoading,
      isFetching,
      detectError: detect.error,
      accessError: accessQuery.error,
      refetch,
      invalidate,
    }),
    [
      playVenueId,
      routeVenueId,
      detectedVenue,
      coords,
      access,
      showCheckIn,
      venueLocked,
      venueLockKey,
      playBlocked,
      canEnterVenueContext,
      isLoading,
      isFetching,
      detect.error,
      accessQuery.error,
      refetch,
      invalidate,
    ],
  );
}
