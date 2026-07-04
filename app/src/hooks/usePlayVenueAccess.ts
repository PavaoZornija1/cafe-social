import { useVenueSession } from '../query';

/**
 * Play-tab venue session (React Query). Prefer `useVenueSession` in new code.
 */
export function usePlayVenueAccess(routeVenueId: string | undefined) {
  const session = useVenueSession({ routeVenueId });

  return {
    access: session.access,
    resolvedVenueId: session.playVenueId,
    loading: session.isLoading,
    refetch: session.refetch,
    invalidate: session.invalidate,
  };
}
