import { navigationRef } from '../navigation/navigationRef';
import { ensureOnboardingCompleteForNavigation } from './onboardingNavigationGate';
import { openOrderingOrMenu } from './openOrderingLinks';
import { parseVenueOrderNudgePayload } from './venueNudgePush';
import { navigateWordMatchFromPush } from './wordMatchPushNavigation';

/**
 * Central entry for notification taps (foreground tap + cold start).
 * Dispatches by `data.type`; keeps word-match flow separate from other push types.
 */
export async function handleNotificationTapNavigation(
  raw: Record<string, unknown>,
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const nudge = parseVenueOrderNudgePayload(raw);
  if (nudge) {
    await openOrderingOrMenu(nudge.orderingUrl, nudge.menuUrl);
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) navigationRef.navigate('Home');
    }
    return;
  }

  await navigateWordMatchFromPush(raw, getToken);
}
