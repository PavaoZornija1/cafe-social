import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import RootStack from './src/navigation/RootStack';

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
}

export default function App() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="light" />
      <RootStack />
    </NavigationContainer>
  );
}

