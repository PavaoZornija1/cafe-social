import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getLocationPermissionSummary,
  promptOpenSettingsForAlways,
  requestAlwaysLocationPermissions,
} from '../lib/locationPermissions';

const NUDGE_STORAGE_KEY = '@cafe_social/always_location_nudge_at';
const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * After sign-in, nudges users who lack Always toward background permission (geofence alerts).
 */
export function AlwaysLocationPromptEffect() {
  const { isLoaded, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const ranRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !isLoaded || !isSignedIn) return;

    const run = async () => {
      if (ranRef.current) return;
      ranRef.current = true;

      const summary = await getLocationPermissionSummary();
      if (summary.hasAlways) return;

      const lastRaw = await AsyncStorage.getItem(NUDGE_STORAGE_KEY);
      const last = lastRaw ? Number.parseInt(lastRaw, 10) : 0;
      if (last > 0 && Date.now() - last < NUDGE_COOLDOWN_MS) return;

      if (
        summary.foreground !== Location.PermissionStatus.GRANTED &&
        summary.foreground !== Location.PermissionStatus.UNDETERMINED
      ) {
        return;
      }

      const perms = await requestAlwaysLocationPermissions();
      await AsyncStorage.setItem(NUDGE_STORAGE_KEY, String(Date.now()));

      if (perms.backgroundGranted) return;

      if (perms.foregroundGranted) {
        promptOpenSettingsForAlways(
          t('settings.locationAlwaysNeededTitle'),
          t('settings.locationAlwaysNeededBody'),
          t('settings.locationOpenSettings'),
          t('common.cancel'),
        );
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        ranRef.current = false;
        void run();
      }
    });

    void run();

    return () => {
      sub.remove();
    };
  }, [isLoaded, isSignedIn, t]);

  return null;
}
