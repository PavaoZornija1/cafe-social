import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { registerExpoPushTokenWithBackend } from '../lib/expoPush';

/** Registers device for word-match (and future) push notifications after sign-in. */
export function ExpoPushRegistrar() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void registerExpoPushTokenWithBackend(() => getTokenRef.current());
  }, [isLoaded, isSignedIn]);

  return null;
}
