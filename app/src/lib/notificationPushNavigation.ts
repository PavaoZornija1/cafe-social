import { navigationRef } from '../navigation/navigationRef';
import { ensureOnboardingCompleteForNavigation } from './onboardingNavigationGate';
import { openOrderingOrMenu } from './openOrderingLinks';
import {
  parseDailyStreakAtRiskPayload,
  parsePerkExpiryReminderPayload,
  parseVenueCampaignPayload,
  parseVenueProximityArrivalPayload,
} from './partnerMarketingPush';
import { parseVenueOrderNudgePayload } from './venueNudgePush';
import { navigateWordMatchFromPush } from './wordMatchPushNavigation';
import { navigateBrawlerMatchFromPush } from './brawlerMatchPushNavigation';

/**
 * Central entry for notification taps (foreground tap + cold start).
 * Dispatches by `data.type` / `data.kind`; keeps word-match flow separate from other push types.
 */
export async function handleNotificationTapNavigation(
  raw: Record<string, unknown>,
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const kind = typeof raw.kind === 'string' ? raw.kind : undefined;
  if (kind === 'friend_request') {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('MainTabs', { screen: 'FriendsTab' });
      }
    }
    return;
  }
  if (kind === 'party_invite') {
    const partyId = typeof raw.partyId === 'string' ? raw.partyId : undefined;
    if (partyId && navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) navigationRef.navigate('PartyDetail', { partyId });
    }
    return;
  }
  if (kind === 'perk_granted') {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('PerkWallet');
      }
    }
    return;
  }
  if (kind === 'receipt_reviewed') {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('PerkWallet');
      }
    }
    return;
  }
  if (kind === 'ban_appeal_resolved') {
    const venueId = typeof raw.venueId === 'string' ? raw.venueId : undefined;
    const venueName = typeof raw.venueName === 'string' ? raw.venueName : undefined;
    const appealId = typeof raw.appealId === 'string' ? raw.appealId : undefined;
    if (venueId && navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('BanAppeal', {
          venueId,
          venueName,
          focusAppealId: appealId,
        });
      }
    }
    return;
  }

  const streakAtRisk = parseDailyStreakAtRiskPayload(raw);
  if (streakAtRisk) {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) navigationRef.navigate('DailyWord');
    }
    return;
  }

  const perkExpiry = parsePerkExpiryReminderPayload(raw);
  if (perkExpiry) {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('PerkWallet');
      }
    }
    return;
  }

  const proximityArrival = parseVenueProximityArrivalPayload(raw);
  if (proximityArrival) {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('VenueHub', {
          venueId: proximityArrival.venueId,
          venueName: proximityArrival.venueName,
        });
      }
    }
    return;
  }

  const campaign = parseVenueCampaignPayload(raw);
  if (campaign) {
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) {
        navigationRef.navigate('VenueHub', {
          venueId: campaign.venueId,
          venueName: campaign.venueName,
        });
      }
    }
    return;
  }

  const nudge = parseVenueOrderNudgePayload(raw);
  if (nudge) {
    await openOrderingOrMenu(nudge.orderingUrl, nudge.menuUrl);
    if (navigationRef.isReady()) {
      const ok = await ensureOnboardingCompleteForNavigation(getToken);
      if (ok) navigationRef.navigate('MainTabs', { screen: 'HomeTab' });
    }
    return;
  }

  await navigateBrawlerMatchFromPush(raw, getToken);
  await navigateWordMatchFromPush(raw, getToken);
}
