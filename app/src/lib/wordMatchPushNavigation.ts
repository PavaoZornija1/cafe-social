import { Alert } from 'react-native';
import { apiGet } from './api';
import { fetchDetectedVenue } from './venueDetectClient';
import { navigationRef } from '../navigation/navigationRef';
import { ensureOnboardingCompleteForNavigation } from './onboardingNavigationGate';

type WordMatchState = {
  sessionId: string;
  status: string;
  mode: 'coop' | 'versus';
  difficulty: string;
  venueId?: string | null;
  targetWordCount: number;
  deckCategory?: string | null;
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

function asDifficulty(d: string): 'easy' | 'normal' | 'hard' {
  if (d === 'easy' || d === 'normal' || d === 'hard') return d;
  return 'easy';
}

/**
 * Opens Word match wait or game from a push notification payload (or cold-start response).
 * Other notification types are handled in `notificationPushNavigation.ts`.
 */
export async function navigateWordMatchFromPush(
  raw: Record<string, unknown>,
  getToken: () => Promise<string | null | undefined>,
): Promise<void> {
  const type = raw.type;
  if (type !== 'word_match_join' && type !== 'word_match_start') return;

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

  let state: WordMatchState;
  try {
    state = await apiGet<WordMatchState>(
      `/words/matches/${encodeURIComponent(sessionId)}/state`,
      token,
    );
  } catch {
    Alert.alert(
      'Cafe Social',
      'Could not open this match. It may have ended or you may not be a participant.',
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
  const { venue: detected } = await fetchDetectedVenue();
  const venueId = fromStateVenue ?? fromPushVenue ?? detected?.id ?? null;

  if (!venueId) {
    Alert.alert(
      'Cafe Social',
      'Open the app at a partner café (or enable location) to continue this word match.',
    );
    return;
  }

  const difficulty = asDifficulty(state.difficulty);
  const mode = state.mode === 'versus' ? 'versus' : 'coop';
  const words = state.targetWordCount ?? 5;

  const wordCategory = state.deckCategory ?? undefined;

  if (state.status === 'PENDING') {
    navigationRef.navigate('WordMatchWait', {
      venueId,
      mode,
      difficulty,
      create: false,
      sessionId,
      wordCount: words,
      wordCategory,
    });
    return;
  }

  if (state.status === 'ACTIVE' || state.status === 'FINISHED') {
    navigationRef.navigate('WordGame', {
      venueId,
      difficulty,
      mode,
      matchSessionId: sessionId,
      sessionWordsCount: words,
      wordCategory,
    });
    return;
  }

  navigationRef.navigate('WordMatchWait', {
    venueId,
    mode,
    difficulty,
    create: false,
    sessionId,
    wordCount: words,
    wordCategory,
  });
}
