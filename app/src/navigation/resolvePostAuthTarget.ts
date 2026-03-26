import { apiGet } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { fetchOwnerVenues } from '../lib/ownerStaffApi';
import {
  isPlayerOnboardingDone,
  isStaffOnboardingDone,
  syncOnboardingFromServerSummary,
} from '../lib/onboardingStorage';

export type PostAuthTarget = 'Onboarding' | 'Home';

/**
 * After Clerk sign-in, route to onboarding when player or staff intro is still pending.
 * Staff (any venue on {@link fetchOwnerVenues}) see only the staff intro until completed.
 * Server-completed onboarding (reinstall) is merged via {@link syncOnboardingFromServerSummary}.
 */
export async function resolvePostAuthTarget(
  getToken: () => Promise<string | null | undefined>,
): Promise<PostAuthTarget> {
  const token = await getToken();
  if (!token) return 'Home';

  let isStaff = false;
  try {
    const [summary, owner] = await Promise.all([
      apiGet<MeSummaryDto>('/players/me/summary', token),
      fetchOwnerVenues(token),
    ]);
    await syncOnboardingFromServerSummary(summary);
    isStaff = owner.venues.length > 0;
  } catch {
    try {
      const { venues } = await fetchOwnerVenues(token);
      isStaff = venues.length > 0;
    } catch {
      isStaff = false;
    }
  }

  const [staffDone, playerDone] = await Promise.all([
    isStaffOnboardingDone(),
    isPlayerOnboardingDone(),
  ]);

  if (isStaff && !staffDone) return 'Onboarding';
  if (!isStaff && !playerDone) return 'Onboarding';
  return 'Home';
}
