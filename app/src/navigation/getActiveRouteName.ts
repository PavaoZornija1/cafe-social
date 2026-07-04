import type { NavigationState, PartialState } from '@react-navigation/native';

/** Deepest focused route in the navigation tree (tabs, stacks). */
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
