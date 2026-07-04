import { useAuth } from '@clerk/expo';
import { focusManager, onlineManager, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { createAppQueryClient } from './queryClient';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

/**
 * TanStack Query provider. Must sit under ClerkProvider so hooks can use `useAuth`.
 * Clears the cache on sign-out so the next account never sees stale venue/me data.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => createAppQueryClient());
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      onlineManager.setEventListener((setOnline) => {
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
          window.removeEventListener('online', onOnline);
          window.removeEventListener('offline', onOffline);
        };
      });
    }
  }, []);

  useEffect(() => {
    if (isSignedIn === false) {
      client.clear();
    }
  }, [client, isSignedIn]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
