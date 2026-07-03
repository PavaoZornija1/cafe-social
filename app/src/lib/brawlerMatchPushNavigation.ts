import { Alert } from 'react-native';
import { apiGet } from './api';
import { navigationRef } from '../navigation/navigationRef';
import { ensureOnboardingCompleteForNavigation } from './onboardingNavigationGate';

type BrawlerSessionState = {
  sessionId: string;
  status: string;
  venueId?: string | null;
};

const dedupe = new Map<string, number>();
const DEDUPE_MS = 4000;

function allowNavigate(sessionId: string): boolean {
  const now = Date.now();
  const prev = dedupe.get(sessionId) ?? 0;
  if (now - prev < DEDUPE_MS) return false;
  dedupe.set(sessionId, now);
  return true;
}

export async function navigateBrawlerMatchFromPush(
  raw: Record<string, unknown>,
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const type = raw.type;
  if (type !== 'brawler_match_start') return;

  const sessionId =
    typeof raw.sessionId === 'string' ? raw.sessionId : undefined;
  if (!sessionId) return;

  if (!navigationRef.isReady()) return;

  const token = await getToken();
  if (!token) {
    Alert.alert('Cafe Social', 'Sign in to open this match.');
    return;
  }

  const onboardingOk = await ensureOnboardingCompleteForNavigation(getToken);
  if (!onboardingOk) return;

  if (!allowNavigate(sessionId)) return;

  let state: BrawlerSessionState;
  try {
    state = await apiGet<BrawlerSessionState>(
      `/brawler/sessions/${encodeURIComponent(sessionId)}`,
      token,
    );
  } catch {
    Alert.alert(
      'Cafe Social',
      'Could not open this brawler match. It may have ended.',
    );
    return;
  }

  const fromPushVenue =
    typeof raw.venueId === 'string' && raw.venueId.trim() !== ''
      ? raw.venueId.trim()
      : null;
  const fromStateVenue =
    typeof state.venueId === 'string' && state.venueId.trim() !== ''
      ? state.venueId.trim()
      : null;
  const venueId = fromStateVenue ?? fromPushVenue ?? undefined;

  if (state.status === 'ACTIVE' || state.status === 'PENDING') {
    navigationRef.navigate('BrawlerArena', {
      sessionId,
      venueId,
    });
    return;
  }

  navigationRef.navigate('BrawlerVenueQueue', { venueId });
}
