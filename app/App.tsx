import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050816',
      }}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: 24,
          fontWeight: '600',
          textAlign: 'center',
          paddingHorizontal: 24,
        }}
      >
        Cafe Social
      </Text>
      <Text
        style={{
          color: '#9ca3af',
          fontSize: 14,
          textAlign: 'center',
          marginTop: 12,
          paddingHorizontal: 24,
        }}
      >
        Location-locked social gaming for cafés. This is the starter shell for
        the player app.
      </Text>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

