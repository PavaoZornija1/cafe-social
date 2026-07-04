import { useAuth } from '@clerk/expo';
import { useCallback } from 'react';

/** Clerk session token for authenticated API queries. */
export function useAuthToken() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const requireToken = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return token;
  }, [getToken]);

  return {
    isReady: Boolean(isLoaded && isSignedIn),
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    getToken,
    requireToken,
  };
}
