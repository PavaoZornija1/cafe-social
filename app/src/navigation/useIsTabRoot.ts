import { useRoute } from '@react-navigation/native';

/** True when the screen is mounted as a bottom-tab root (hide stack-style back). */
export function useIsTabRoot(tabRouteName: string): boolean {
  const route = useRoute();
  return route.name === tabRouteName;
}
