import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as WebBrowser from 'expo-web-browser';
import type { LinkingOptions } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import './src/lib/venueGeofenceTask';
import AppNavigation from './src/navigation/AppNavigation';
import type { RootStackParamList } from './src/navigation/type';
import { initI18n } from './src/i18n';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';

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

export default function App() {
  return (
    <ThemeProvider>
      <AppBoot linking={linking} />
    </ThemeProvider>
  );
}

function AppBoot({ linking }: { linking: LinkingOptions<RootStackParamList> }) {
  const [i18nReady, setI18nReady] = useState(false);
  const { colors } = useAppTheme();

  useEffect(() => {
    let cancelled = false;
    void initI18n().finally(() => {
      if (!cancelled) setI18nReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadingStyle = useMemo(
    () => ({
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [colors.bg],
  );

  if (!i18nReady) {
    return (
      <View style={loadingStyle}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <AppNavigation linking={linking} />
    </ClerkProvider>
  );
}
