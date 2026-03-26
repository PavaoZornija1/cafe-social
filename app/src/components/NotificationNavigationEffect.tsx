import { useAuth } from '@clerk/expo';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef } from 'react';
import { handleNotificationTapNavigation } from '../lib/notificationPushNavigation';

/** Handles notification taps → route by payload type (word match, venue nudge, …). */
export function NotificationNavigationEffect() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const coldStartDone = useRef(false);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      void handleNotificationTapNavigation(data ?? {}, () => getTokenRef.current());
    });

    if (!coldStartDone.current) {
      coldStartDone.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, unknown>;
        void handleNotificationTapNavigation(data ?? {}, () => getTokenRef.current());
      });
    }

    return () => sub.remove();
  }, []);

  return null;
}
