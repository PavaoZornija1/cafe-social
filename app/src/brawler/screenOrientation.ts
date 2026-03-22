import type { NavigationState, PartialState } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

/** Landscape only in the arena; hero lobby (`BrawlerLobby`) stays portrait. */
const LANDSCAPE_ROUTE_NAMES = new Set(['BrawlerArena']);

export function getActiveRouteName(
  state: NavigationState | PartialState<NavigationState> | undefined,
): string | undefined {
  if (state == null || state.index === undefined) return undefined;
  const route = state.routes[state.index];
  if (!route) return undefined;
  if (route.state) {
    return getActiveRouteName(
      route.state as NavigationState | PartialState<NavigationState>,
    );
  }
  return route.name;
}

/**
 * Lock landscape only on `BrawlerArena` (after “Enter arena”); portrait elsewhere.
 * Safe to call from `NavigationContainer` `onStateChange` / `onReady`.
 */
export async function syncBrawlerScreenOrientation(
  state: NavigationState | PartialState<NavigationState> | undefined,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const routeName = getActiveRouteName(state);
  const inArena =
    routeName !== undefined && LANDSCAPE_ROUTE_NAMES.has(routeName);

  try {
    if (inArena) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      );
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      );
    }
  } catch {
    // Simulators / unsupported
  }
}
