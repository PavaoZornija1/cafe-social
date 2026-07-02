import type { NavigatorScreenParams } from '@react-navigation/native';

/** Routes inside the signed-in bottom tab navigator.
 *  Legacy stack routes `Home`, `Profile`, and `PartnerVenuesMap` were removed — use these tabs instead. */
export type MainTabParamList = {
  HomeTab: undefined;
  PlayTab: { venueId?: string; challengeId?: string } | undefined;
  VenuesTab: undefined;
  FriendsTab: undefined;
  MeTab: undefined;
};

export const MAIN_APP_ROUTE = 'MainTabs' as const;

/** Navigate to the home tab from any stack screen. */
export function mainTabsHomeParams(): NavigatorScreenParams<MainTabParamList> {
  return { screen: 'HomeTab' };
}
