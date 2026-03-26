import { navigationRef } from '../navigation/navigationRef';
import { navigateWordMatchFromPush } from './wordMatchPushNavigation';
import { openOrderingOrMenu } from './openOrderingLinks';

/**
 * Central entry for notification taps (foreground tap + cold start).
 * Dispatches by `data.type`; keeps word-match flow separate from other push types.
 */
export async function handleNotificationTapNavigation(
  raw: Record<string, unknown>,
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const type = raw.type;

  if (type === 'venue_order_nudge') {
    const orderingUrl =
      typeof raw.orderingUrl === 'string' ? raw.orderingUrl : '';
    const menuUrl = typeof raw.menuUrl === 'string' ? raw.menuUrl : '';
    await openOrderingOrMenu(orderingUrl, menuUrl);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Home');
    }
    return;
  }

  await navigateWordMatchFromPush(raw, getToken);
}
