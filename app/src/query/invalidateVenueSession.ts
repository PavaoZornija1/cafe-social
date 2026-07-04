import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from './queryKeys';

/** After check-in, lock changes, or leaving a venue — refresh detect + access (+ optional venue slices). */
export async function invalidateVenueSession(
  queryClient: QueryClient,
  venueId?: string | null,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.venue.detect() });
  if (venueId) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.venue.accessPrefix(venueId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.venue.offers(venueId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.venue.publicCard(venueId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.venue.challenges(venueId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.venue.hub(venueId) });
  } else {
    await queryClient.invalidateQueries({ queryKey: queryKeys.venue.all });
  }
}

export async function invalidateMeSummary(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.me.summary() });
}
