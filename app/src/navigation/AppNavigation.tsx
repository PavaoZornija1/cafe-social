import { useAuth } from '@clerk/expo';
import {
  DarkTheme,
  NavigationContainer,
  type LinkingOptions,
  type NavigationState,
} from '@react-navigation/native';
import React, { useCallback, useRef } from 'react';

import { StatusBar } from 'expo-status-bar';

import { syncBrawlerScreenOrientation } from '../brawler/screenOrientation';
import { ExpoPushRegistrar } from '../components/ExpoPushRegistrar';
import RevenueCatIdentitySync from '../components/RevenueCatIdentitySync';
import { NotificationNavigationEffect } from '../components/NotificationNavigationEffect';
import { VenuePresenceHeartbeat } from '../components/VenuePresenceHeartbeat';
import { navigationRef } from './navigationRef';
import { resolvePostAuthTarget } from './resolvePostAuthTarget';
import RootStack from './RootStack';
import type { RootStackParamList } from './type';

const EXEMPT_FROM_ONBOARDING_GUARD = new Set(['Login', 'SignUp', 'Onboarding']);

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#050816',
    card: '#18181b',
    text: '#f4f4f5',
    border: '#27272a',
    notification: '#f4f4f5',
    primary: '#f4f4f5',
    secondary: '#e4e4e7',
    tertiary: '#d4d4d8',
  },
};

type Props = {
  linking: LinkingOptions<RootStackParamList>;
};

export default function AppNavigation({ linking }: Props) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const onboardingSeq = useRef(0);

  const runOnboardingGuard = useCallback(() => {
    if (!isLoaded || !isSignedIn) return;
    const seq = ++onboardingSeq.current;
    void (async () => {
      await Promise.resolve();
      if (seq !== onboardingSeq.current || !navigationRef.isReady()) return;
      const route = navigationRef.getCurrentRoute();
      const name = route?.name;
      if (!name || EXEMPT_FROM_ONBOARDING_GUARD.has(name)) return;
      const next = await resolvePostAuthTarget(() => getTokenRef.current());
      if (seq !== onboardingSeq.current) return;
      if (next === 'Onboarding') {
        navigationRef.navigate('Onboarding');
      }
    })();
  }, [isLoaded, isSignedIn]);

  const onStateChange = useCallback(
    (state: NavigationState | undefined) => {
      void syncBrawlerScreenOrientation(state);
      runOnboardingGuard();
    },
    [runOnboardingGuard],
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
      onReady={() => {
        void syncBrawlerScreenOrientation(navigationRef.getRootState());
        runOnboardingGuard();
      }}
      onStateChange={onStateChange}
    >
      <NotificationNavigationEffect />
      <RevenueCatIdentitySync />
      <VenuePresenceHeartbeat />
      <ExpoPushRegistrar />
      <StatusBar style="light" />
      <RootStack />
    </NavigationContainer>
  );
}
