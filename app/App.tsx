import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as WebBrowser from 'expo-web-browser';
import {
  DarkTheme,
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { syncBrawlerScreenOrientation } from './src/brawler/screenOrientation';
import { ExpoPushRegistrar } from './src/components/ExpoPushRegistrar';
import { NotificationNavigationEffect } from './src/components/NotificationNavigationEffect';
import RootStack from './src/navigation/RootStack';
import { navigationRef } from './src/navigation/navigationRef';
import type { RootStackParamList } from './src/navigation/type';
import { initI18n } from './src/i18n';

// Required so OAuth redirect (e.g. Google SSO) can close the browser and return to the app
WebBrowser.maybeCompleteAuthSession();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;
if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file');
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['cafesocial://'],
  config: {
    screens: {
      RedeemInvite: {
        path: 'redeem',
        parse: {
          token: (token: string) => token ?? '',
        },
      },
    },
  },
};

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

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void initI18n().finally(() => {
      if (!cancelled) setI18nReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!i18nReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#050816',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={linking}
        onReady={() => {
          void syncBrawlerScreenOrientation(navigationRef.getRootState());
        }}
        onStateChange={(state) => {
          void syncBrawlerScreenOrientation(state);
        }}
      >
        <NotificationNavigationEffect />
        <ExpoPushRegistrar />
        <StatusBar style="light" />
        <RootStack />
      </NavigationContainer>
    </ClerkProvider>
  );
}
