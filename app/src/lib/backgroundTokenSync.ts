import { apiDelete, apiPost } from './api';
import {
  backgroundTokenNeedsRefresh,
  setBackgroundApiToken,
} from './backgroundApiToken';

type BackgroundTokenResponse = {
  token: string;
  expiresAt: string;
};

/**
 * Ensures a long-lived background token is stored for OS geofence callbacks.
 * Clerk session JWTs expire too quickly for enter/exit while the app is killed.
 */
export async function ensureBackgroundApiToken(
  getClerkToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const needs = await backgroundTokenNeedsRefresh();
  if (!needs) return;
  const clerkToken = await getClerkToken();
  if (!clerkToken) return;
  const issued = await apiPost<BackgroundTokenResponse>(
    '/players/me/background-token',
    {},
    clerkToken,
  );
  await setBackgroundApiToken(issued.token, issued.expiresAt);
}

export async function revokeBackgroundApiToken(
  getClerkToken: () => Promise<string | null | undefined>,
): Promise<void> {
  try {
    const clerkToken = await getClerkToken();
    if (clerkToken) {
      await apiDelete('/players/me/background-token', clerkToken);
    }
  } catch {
    /* best-effort */
  }
  await setBackgroundApiToken(null);
}
