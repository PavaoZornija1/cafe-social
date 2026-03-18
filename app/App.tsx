import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import * as WebBrowser from 'expo-web-browser';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import RootStack from './src/navigation/RootStack';

// Required so OAuth redirect (e.g. Google SSO) can close the browser and return to the app
WebBrowser.maybeCompleteAuthSession();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;
if (!publishableKey) {
  throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env file');
}

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
  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="light" />
        <RootStack />
      </NavigationContainer>
    </ClerkProvider>
  );
}

