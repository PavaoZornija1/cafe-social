import { useAuth } from '@clerk/expo';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef } from 'react';
import { navigateWordMatchFromPush } from '../lib/wordMatchPushNavigation';

/** Handles notification taps → deep link into word match (join / start). */
export function NotificationNavigationEffect() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const coldStartDone = useRef(false);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      void navigateWordMatchFromPush(data ?? {}, () => getTokenRef.current());
    });

    if (!coldStartDone.current) {
      coldStartDone.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown>;
        void navigateWordMatchFromPush(data ?? {}, () => getTokenRef.current());
      });
    }

    return () => sub.remove();
  }, []);

  return null;
}
