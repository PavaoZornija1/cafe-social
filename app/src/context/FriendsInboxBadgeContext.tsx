import { useAuth } from '@clerk/expo';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  countSocialInboxPending,
  fetchSocialInbox,
} from '../lib/socialInboxApi';

const POLL_MS = 60_000;

type FriendsInboxBadgeContextValue = {
  pendingCount: number;
  refreshPendingCount: () => Promise<void>;
};

const FriendsInboxBadgeContext = createContext<FriendsInboxBadgeContextValue>({
  pendingCount: 0,
  refreshPendingCount: async () => {},
});

export function FriendsInboxBadgeProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setPendingCount(0);
      return;
    }
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setPendingCount(0);
        return;
      }
      const inbox = await fetchSocialInbox(token);
      setPendingCount(countSocialInboxPending(inbox));
    } catch {
      /* keep last count */
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const id = setInterval(() => {
      void refreshPendingCount();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isLoaded, isSignedIn, refreshPendingCount]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refreshPendingCount();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [isLoaded, isSignedIn, refreshPendingCount]);

  const value = useMemo(
    () => ({ pendingCount, refreshPendingCount }),
    [pendingCount, refreshPendingCount],
  );

  return (
    <FriendsInboxBadgeContext.Provider value={value}>
      {children}
    </FriendsInboxBadgeContext.Provider>
  );
}

export function useFriendsInboxBadge(): FriendsInboxBadgeContextValue {
  return useContext(FriendsInboxBadgeContext);
}
