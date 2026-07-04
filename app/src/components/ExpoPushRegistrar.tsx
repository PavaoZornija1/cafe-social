import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { registerExpoPushTokenWithBackend } from '../lib/expoPush';

/** Registers device for push (match, dwell, arrival) after sign-in and on foreground. */
export function ExpoPushRegistrar() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const register = () => {
      void registerExpoPushTokenWithBackend(() => getTokenRef.current());
    };

    register();
    if (Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') register();
    });
    return () => sub.remove();
  }, [isLoaded, isSignedIn]);

  return null;
}
