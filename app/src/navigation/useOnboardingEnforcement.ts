import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef } from 'react';

import type { RootStackParamList } from './type';
import { resolvePostAuthTarget } from './resolvePostAuthTarget';

/**
 * Sends the user to Onboarding when they still owe it (e.g. opened Home / party from a link before finishing).
 */
export function useOnboardingEnforcement(
  navigation: NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>,
): void {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useFocusEffect(
    useCallback(() => {
      if (!isLoaded || !isSignedIn) return undefined;
      let cancelled = false;
      void (async () => {
        const next = await resolvePostAuthTarget(() => getTokenRef.current());
        if (cancelled || next !== 'Onboarding') return;
        navigation.replace('Onboarding');
      })();
      return () => {
        cancelled = true;
      };
    }, [isLoaded, isSignedIn, navigation]),
  );
}
