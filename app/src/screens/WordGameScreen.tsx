import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useWordMatchSocket } from '../lib/useWordMatchSocket';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import type { MeSummaryDto } from '../lib/meSummary';
import { useVenueActivePlayBudgetSync } from '../lib/useVenueActivePlayBudgetSync';
import { triggerFeedback } from '../lib/feedback';
import { presentPostGameCarousel } from '../lib/postGame/openPostGameCarousel';
import type { PostGamePayload } from '../lib/postGame/types';
import { hidePostGameCarousel } from '../components/postGame';
import WordGameClueCard from '../components/word/WordGameClueCard';
import ScreenHeader from '../components/ScreenHeader';
import WordGameHud from '../components/word/WordGameHud';
import WordGameVersusBoard from '../components/word/WordGameVersusBoard';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'WordGame'>;

/** Hint payload from API (no answer `text`). */
type WordRow = {
  id: string;
  language: string;
  category: string;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
};

type MpDeckResponse = {
  mode: 'coop' | 'versus';
  wordIndex: number;
  targetWordCount: number;
  currentWord: WordRow | null;
  snapshotRev?: number | null;
};

type MatchParticipant = {
  id: string;
  playerId: string | null;
  username: string;
  score: number;
  result: string | null;
  isYou: boolean;
};

type MatchState = {
  sessionId: string;
  status: string;
  mode: 'coop' | 'versus';
  difficulty: string;
  ranked?: boolean;
  venueId?: string | null;
  hostPlayerId: string;
  inviteCode: string | null;
  targetWordCount: number;
  sharedWordIndex: number;
  deckLanguage?: string;
  deckCategory?: string | null;
  participants: MatchParticipant[];
  snapshotRev?: number | null;
  postGame?: PostGamePayload;
};

function secondsPerWord(diff?: string): number {
  if (diff === 'easy') return 90;
  if (diff === 'hard') return 30;
  return 60;
}

export default function WordGameScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    difficulty,
    sessionWordsCount = 5,
    mode = 'solo',
    matchSessionId,
    wordCategory,
    ranked: rankedRoute,
  } = route.params ?? {};
  const globalSolo = !matchSessionId && !venueId;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const presenceCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<WordRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState('');
  const [extraHintRevealed, setExtraHintRevealed] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [wrongFeedback, setWrongFeedback] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [soloSessionId, setSoloSessionId] = useState<string | null>(null);
  const [soloTargetCount, setSoloTargetCount] = useState(sessionWordsCount);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [soloFinished, setSoloFinished] = useState(false);
  const [postGamePayload, setPostGamePayload] = useState<PostGamePayload | null>(null);

  const soloStartedRef = useRef(false);
  const mpBootDoneRef = useRef(false);
  const postGamePresentedRef = useRef(false);
  const submittingRef = useRef(false);
  const timeUpFiredRef = useRef(false);
  const timerUrgentFiredRef = useRef(false);
  const matchEndFeedbackFiredRef = useRef(false);
  const matchSnapshotRevRef = useRef<number | undefined>(undefined);

  const matchMode = matchSessionId ? mode : 'solo';

  useEffect(() => {
    matchSnapshotRevRef.current = undefined;
  }, [matchSessionId]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const s = await apiGet<MeSummaryDto>('/players/me/summary', token);
        if (!cancelled) setSubscriptionActive(Boolean(s.subscriptionActive));
      } catch {
        /* non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded]);

  const activePlayBudgetEnabled =
    Boolean(venueId) &&
    !subscriptionActive &&
    (matchSessionId ? matchState?.status === 'ACTIVE' : Boolean(soloSessionId));

  useVenueActivePlayBudgetSync({
    getToken: () => getTokenRef.current(),
    venueId: venueId ?? null,
    subscriptionActive,
    kind: matchSessionId ? 'word_match' : 'solo_word',
    gameSessionId: matchSessionId,
    soloWordSessionId: soloSessionId,
    enabled: activePlayBudgetEnabled,
    onBudgetExhausted: () => {
      Alert.alert(t('wordGame.playTimeExhaustedTitle'), t('wordGame.playTimeExhaustedBody'), [
        { text: 'OK', onPress: () => navigation.replace('MainTabs', { screen: 'HomeTab' }) },
      ]);
    },
  });

  const leaveGame = useCallback(() => {
    void (async () => {
      const st = matchState?.status;
      if (
        matchSessionId &&
        st !== 'FINISHED' &&
        st !== 'CANCELLED'
      ) {
        try {
          const token = await getTokenRef.current();
          if (token) {
            await apiPost(
              `/words/matches/${encodeURIComponent(matchSessionId)}/leave`,
              {
                ...(typeof matchSnapshotRevRef.current === 'number'
                  ? { ifSnapshotRev: matchSnapshotRevRef.current }
                  : {}),
              },
              token,
            );
          }
        } catch {
          /* still exit UI */
        }
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('MainTabs');
      }
    })();
  }, [navigation, matchSessionId, matchState?.status]);
  const coopIdx = matchState?.sharedWordIndex ?? 0;
  const versusOrSoloIdx = idx;

  /** Server sends one hint card at a time for solo / multiplayer. */
  const currentWord = deck[0];

  /** Always shown — the main written clue (not just a broad category). */
  const primaryClue = useMemo(() => {
    if (!currentWord) return '';
    const s = currentWord.sentenceHint?.trim();
    if (s) return s;
    if (currentWord.wordHints?.length) return currentWord.wordHints.join(', ');
    return currentWord.emojiHints.join(' ');
  }, [currentWord]);

  /** Optional second line: keyword list (easy + normal) or emojis (hard). */
  const extraHintText = useMemo(() => {
    if (!currentWord) return '';
    if (difficulty === 'hard') return currentWord.emojiHints.join(' ');
    return currentWord.wordHints.join(', ');
  }, [currentWord, difficulty]);

  const showExtraHintButton =
    extraHintText.length > 0 && primaryClue !== extraHintText;

  const myVersusScore = matchState?.participants.find((p) => p.isYou)?.score;

  useEffect(() => {
    if (matchMode !== 'versus' || !matchSessionId || myVersusScore === undefined) return;
    setIdx(myVersusScore);
  }, [matchMode, matchSessionId, myVersusScore]);

  const difficultyShort = useMemo(() => {
    if (difficulty === 'easy') return t('wordLobby.easy');
    if (difficulty === 'normal') return t('wordLobby.normal');
    return t('wordLobby.hard');
  }, [difficulty, t]);

  const progressTotal = Math.max(
    matchSessionId
      ? matchState?.targetWordCount ?? 1
      : soloTargetCount || sessionWordsCount || 1,
    1,
  );
  const progressCurrent =
    matchMode === 'coop'
      ? Math.min(coopIdx + 1, progressTotal)
      : Math.min(idx + 1, progressTotal);

  useEffect(() => {
    if (matchMode === 'coop') setExtraHintRevealed(false);
  }, [coopIdx, matchMode]);

  useEffect(() => {
    if (matchMode !== 'coop') setExtraHintRevealed(false);
  }, [versusOrSoloIdx, matchMode]);

  const fetchMatchState = useCallback(async () => {
    const sid = matchSessionId;
    if (!sid) return;
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const s = await apiGet<MatchState>(
        `/words/matches/${encodeURIComponent(sid)}/state`,
        token,
      );
      if (typeof s.snapshotRev === 'number') {
        matchSnapshotRevRef.current = s.snapshotRev;
      }
      setMatchState(s);
    } catch {
      /* non-fatal */
    }
  }, [matchSessionId]);

  useEffect(() => {
    if (!matchSessionId || !isLoaded) return;
    void fetchMatchState();
  }, [matchSessionId, isLoaded, fetchMatchState]);

  useEffect(() => {
    mpBootDoneRef.current = false;
  }, [matchSessionId]);

  const { socketStatus } = useWordMatchSocket({
    sessionId: matchSessionId ?? null,
    enabled: !!matchSessionId && isLoaded,
    getToken: async () => (await getTokenRef.current?.()) ?? null,
    onRefresh: fetchMatchState,
    fallbackPollMs: 30000,
  });

  /** Solo — server session; answers validated on guess */
  useEffect(() => {
    if (matchSessionId) return;
    let cancelled = false;

    async function run() {
      if (!isLoaded) return;
      if (soloStartedRef.current) return;
      soloStartedRef.current = true;

      try {
        setLoading(true);
        setError(null);

        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');

        const primary = toApiWordLanguage(i18n.language);
        let lat: number | undefined;
        let lng: number | undefined;
        if (!globalSolo) {
          if (!venueId) throw new Error(t('wordGame.needVenuePresence'));
          const { venue, coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
          if (!coords || venue?.id !== venueId) {
            throw new Error(t('wordGame.needVenuePresence'));
          }
          presenceCoordsRef.current = coords;
          lat = coords.lat;
          lng = coords.lng;
        } else {
          presenceCoordsRef.current = null;
        }

        const baseBody = {
          wordCount: sessionWordsCount,
          difficulty: difficulty ?? 'normal',
          globalPlay: globalSolo,
          venueId: venueId ?? undefined,
          latitude: lat,
          longitude: lng,
          category: wordCategory,
        };

        const tryStart = (lang: string) =>
          apiPost<{
            sessionId: string;
            targetWordCount: number;
            wordIndex: number;
            currentWord: WordRow | null;
          }>('/words/session/start', { ...baseBody, language: lang }, token);

        let start: Awaited<ReturnType<typeof tryStart>>;
        try {
          start = await tryStart(primary);
        } catch (firstErr) {
          if (primary !== 'en') {
            try {
              start = await tryStart('en');
            } catch {
              throw firstErr instanceof Error
                ? firstErr
                : new Error(t('wordGame.loadError'));
            }
          } else {
            throw firstErr instanceof Error
              ? firstErr
              : new Error(t('wordGame.loadError'));
          }
        }
        if (cancelled) return;
        if (!start.currentWord) {
          setError(t('wordGame.emptyDeck'));
          setDeck([]);
          return;
        }
        setSoloSessionId(start.sessionId);
        setSoloTargetCount(start.targetWordCount);
        setIdx(start.wordIndex);
        setDeck([start.currentWord]);
      } catch (e) {
        if (cancelled) return;
        soloStartedRef.current = false;
        setError((e as Error).message || t('wordGame.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    sessionWordsCount,
    difficulty,
    t,
    matchSessionId,
    i18n.language,
    globalSolo,
    venueId,
    wordCategory,
  ]);

  /** Multiplayer: state + one hint card; refetch when co-op index or your versus score changes */
  useEffect(() => {
    if (!matchSessionId || !isLoaded) return;
    if (matchMode !== 'coop' && matchMode !== 'versus') return;
    const sessionKey = matchSessionId;

    let cancelled = false;
    const showSpinner = !mpBootDoneRef.current;

    async function run() {
      try {
        if (showSpinner) {
          setLoading(true);
          mpBootDoneRef.current = true;
        }
        setError(null);
        const auth = await getTokenRef.current();
        if (!auth) throw new Error('Not authenticated');
        const s = await apiGet<MatchState>(
          `/words/matches/${encodeURIComponent(sessionKey)}/state`,
          auth,
        );
        if (cancelled) return;
        if (typeof s.snapshotRev === 'number') {
          matchSnapshotRevRef.current = s.snapshotRev;
        }
        setMatchState(s);
        if (s.status !== 'ACTIVE') {
          setDeck([]);
          return;
        }
        let deckQs = '';
        if (s.venueId) {
          const { venue, coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
          if (!coords || venue?.id !== s.venueId) {
            presenceCoordsRef.current = null;
            setError(t('wordGame.needVenueForMatch'));
            setDeck([]);
            return;
          }
          presenceCoordsRef.current = coords;
          deckQs = `?lat=${encodeURIComponent(String(coords.lat))}&lng=${encodeURIComponent(String(coords.lng))}`;
        } else {
          presenceCoordsRef.current = null;
        }
        const res = await apiGet<MpDeckResponse>(
          `/words/matches/${encodeURIComponent(sessionKey)}/deck${deckQs}`,
          auth,
        );
        if (cancelled) return;
        if (typeof res.snapshotRev === 'number') {
          matchSnapshotRevRef.current = res.snapshotRev;
        }
        if (!res.currentWord) {
          setDeck([]);
          return;
        }
        setDeck([res.currentWord]);
        if (matchMode === 'versus') setIdx(res.wordIndex);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || t('wordGame.loadError'));
      } finally {
        if (showSpinner && !cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [matchSessionId, isLoaded, matchMode, coopIdx, myVersusScore, t]);

  const finishSession = useCallback(() => {
    navigation.replace('MainTabs');
  }, [navigation]);

  const onRematch = useCallback(async () => {
    if (!matchSessionId || !matchState) return;
    setRematchBusy(true);
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const res = await apiPost<{ sessionId: string }>(
        `/words/matches/${encodeURIComponent(matchSessionId)}/rematch`,
        {
          ...(typeof matchSnapshotRevRef.current === 'number'
            ? { ifSnapshotRev: matchSnapshotRevRef.current }
            : {}),
        },
        token,
      );
      hidePostGameCarousel();
      postGamePresentedRef.current = false;
      setPostGamePayload(null);
      navigation.replace('WordMatchWait', {
        venueId,
        challengeId,
        mode: matchState.mode,
        difficulty: difficulty as 'easy' | 'normal' | 'hard',
        create: false,
        sessionId: res.sessionId,
        wordCount: matchState.targetWordCount,
        wordCategory: matchState.deckCategory ?? undefined,
        ranked:
          matchState.mode === 'versus' && (matchState.ranked ?? rankedRoute)
            ? true
            : undefined,
      });
    } finally {
      setRematchBusy(false);
    }
  }, [
    matchSessionId,
    matchState,
    navigation,
    venueId,
    challengeId,
    difficulty,
    rankedRoute,
  ]);

  const presentResults = useCallback(
    (payload: PostGamePayload) => {
      if (postGamePresentedRef.current) return;
      postGamePresentedRef.current = true;
      const won = payload.summary.won;
      triggerFeedback(won ? 'matchWin' : 'matchLoss');
      presentPostGameCarousel(payload, {
        onDone: finishSession,
        onRematch: payload.summary.showRematch ? () => void onRematch() : undefined,
        rematchBusy,
      });
    },
    [finishSession, onRematch, rematchBusy],
  );

  useEffect(() => {
    if (postGamePayload) {
      presentResults(postGamePayload);
    }
  }, [postGamePayload, presentResults]);

  useEffect(() => {
    if (matchState?.status === 'FINISHED' && matchState.postGame) {
      setPostGamePayload(matchState.postGame);
    }
  }, [matchState?.status, matchState?.postGame]);

  useEffect(() => {
    if (matchState?.status !== 'FINISHED' || matchState.postGame || !matchSessionId) return;
    void fetchMatchState();
  }, [matchState?.status, matchState?.postGame, matchSessionId, fetchMatchState]);

  const handleTimeUp = useCallback(async () => {
    if (submittingRef.current) return;
    if (timeUpFiredRef.current) return;
    timeUpFiredRef.current = true;
    triggerFeedback('timerUp');
    try {
      if (matchMode === 'coop' && matchSessionId) {
        const token = await getTokenRef.current();
        if (!token) {
          timeUpFiredRef.current = false;
          return;
        }
        let res: {
          done: boolean;
          skipped?: boolean;
          newIndex: number;
          currentWord: WordRow | null;
        };
        try {
          res = await apiPost(
            `/words/matches/${encodeURIComponent(matchSessionId)}/coop-pass`,
            {
              latitude: presenceCoordsRef.current?.lat,
              longitude: presenceCoordsRef.current?.lng,
              ...(typeof matchSnapshotRevRef.current === 'number'
                ? { ifSnapshotRev: matchSnapshotRevRef.current }
                : {}),
            },
            token,
          );
        } catch (e) {
          if ((e as Error & { status?: number }).status === 409) {
            await fetchMatchState();
            setWrongFeedback(t('wordGame.snapshotStaleRetry'));
            return;
          }
          throw e;
        }
        setGuess('');
        setExtraHintRevealed(false);
        if (res.currentWord) setDeck([res.currentWord]);
        else setDeck([]);
        try {
          const s = await apiGet<MatchState>(
            `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
            token,
          );
          setMatchState(s);
        } catch {
          /* non-fatal */
        }
        setWrongFeedback(
          res.done ? t('wordGame.timeExpiredCoopDone') : t('wordGame.timeExpiredCoopSkip'),
        );
        return;
      }

      if (matchMode === 'versus' && matchSessionId) {
        const token = await getTokenRef.current();
        if (!token) {
          timeUpFiredRef.current = false;
          return;
        }
        let res: {
          skipped?: boolean;
          finished?: boolean;
          yourScore?: number;
          currentWord: WordRow | null;
        };
        try {
          res = await apiPost(
            `/words/matches/${encodeURIComponent(matchSessionId)}/versus-pass`,
            {
              latitude: presenceCoordsRef.current?.lat,
              longitude: presenceCoordsRef.current?.lng,
              ...(typeof matchSnapshotRevRef.current === 'number'
                ? { ifSnapshotRev: matchSnapshotRevRef.current }
                : {}),
            },
            token,
          );
        } catch (e) {
          if ((e as Error & { status?: number }).status === 409) {
            await fetchMatchState();
            setWrongFeedback(t('wordGame.snapshotStaleRetry'));
            return;
          }
          throw e;
        }
        setGuess('');
        setExtraHintRevealed(false);
        if (res.currentWord) setDeck([res.currentWord]);
        else setDeck([]);
        try {
          const s = await apiGet<MatchState>(
            `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
            token,
          );
          setMatchState(s);
        } catch {
          /* non-fatal */
        }
        setWrongFeedback(
          res.finished
            ? t('wordGame.timeExpiredVersusDone')
            : t('wordGame.timeExpiredVersusSkip'),
        );
        return;
      }

      if (soloSessionId) {
        const token = await getTokenRef.current();
        if (!token) {
          timeUpFiredRef.current = false;
          return;
        }
        const res = await apiPost<{
          passed?: boolean;
          finished: boolean;
          wordIndex: number;
          targetWordCount: number;
          currentWord: WordRow | null;
          postGame?: PostGamePayload;
        }>(
          `/words/session/${encodeURIComponent(soloSessionId)}/pass`,
          {
            latitude: presenceCoordsRef.current?.lat,
            longitude: presenceCoordsRef.current?.lng,
          },
          token,
        );
        setGuess('');
        setExtraHintRevealed(false);
        setSoloTargetCount(res.targetWordCount);
        if (res.currentWord) setDeck([res.currentWord]);
        else setDeck([]);
        setIdx(res.wordIndex);
        setWrongFeedback(
          res.finished ? t('wordGame.timeExpiredSoloDone') : t('wordGame.timeExpiredSoloSkip'),
        );
        if (res.finished) {
          setSoloFinished(true);
          if (res.postGame) setPostGamePayload(res.postGame);
          triggerFeedback('matchWin');
          return;
        }
        return;
      }
    } catch {
      timeUpFiredRef.current = false;
      setWrongFeedback(t('wordGame.timerPassError'));
    }
  }, [matchMode, matchSessionId, soloSessionId, t, fetchMatchState]);

  const timerWordKey = `${currentWord?.id ?? ''}|${matchSessionId ?? ''}|${soloSessionId ?? ''}|${matchMode}`;

  useEffect(() => {
    timeUpFiredRef.current = false;
    timerUrgentFiredRef.current = false;
  }, [timerWordKey]);

  useEffect(() => {
    if (matchState?.status !== 'FINISHED') {
      matchEndFeedbackFiredRef.current = false;
    }
  }, [matchState?.status]);

  useEffect(() => {
    const mpFinished = matchState?.status === 'FINISHED';
    if (loading || error || mpFinished || !currentWord) return undefined;
    let left = secondsPerWord(difficulty);
    setTimeLeft(left);
    const id = setInterval(() => {
      if (submittingRef.current) return;
      left -= 1;
      setTimeLeft(left);
      if (left === 10 && !timerUrgentFiredRef.current) {
        timerUrgentFiredRef.current = true;
        triggerFeedback('timerUrgent');
      }
      if (left <= 0) {
        clearInterval(id);
        void handleTimeUp();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timerWordKey, difficulty, loading, error, matchState?.status, currentWord, handleTimeUp]);

  const handleSubmitGuess = async () => {
    if (!currentWord) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      if (matchMode === 'coop' && matchSessionId) {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        let res: {
          done: boolean;
          correct: boolean;
          newIndex: number;
          currentWord: WordRow | null;
          postGame?: PostGamePayload;
        };
        try {
          res = await apiPost(
            `/words/matches/${encodeURIComponent(matchSessionId)}/coop-guess`,
            {
              guess,
              latitude: presenceCoordsRef.current?.lat,
              longitude: presenceCoordsRef.current?.lng,
              ...(typeof matchSnapshotRevRef.current === 'number'
                ? { ifSnapshotRev: matchSnapshotRevRef.current }
                : {}),
            },
            token,
          );
        } catch (e) {
          if ((e as Error & { status?: number }).status === 409) {
            await fetchMatchState();
            setWrongFeedback(t('wordGame.snapshotStaleRetry'));
            return;
          }
          throw e;
        }
        if (!res.correct) {
          setWrongFeedback(t('wordGame.wrongGuess'));
          triggerFeedback('wrong');
          return;
        }
        triggerFeedback('correct');
        setWrongFeedback(null);
        setExtraHintRevealed(false);
        setGuess('');
        if (res.currentWord) setDeck([res.currentWord]);
        if (res.done && res.postGame) {
          setPostGamePayload(res.postGame);
        }
        try {
          const s = await apiGet<MatchState>(
            `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
            token,
          );
          if (typeof s.snapshotRev === 'number') {
            matchSnapshotRevRef.current = s.snapshotRev;
          }
          setMatchState(s);
        } catch {
          /* socket refresh will catch up */
        }
        return;
      }

      if (matchMode === 'versus' && matchSessionId) {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        let res: {
          correct: boolean;
          finished: boolean;
          yourScore: number;
          currentWord: WordRow | null;
          postGame?: PostGamePayload;
        };
        try {
          res = await apiPost(
            `/words/matches/${encodeURIComponent(matchSessionId)}/versus-guess`,
            {
              guess,
              latitude: presenceCoordsRef.current?.lat,
              longitude: presenceCoordsRef.current?.lng,
              ...(typeof matchSnapshotRevRef.current === 'number'
                ? { ifSnapshotRev: matchSnapshotRevRef.current }
                : {}),
            },
            token,
          );
        } catch (e) {
          if ((e as Error & { status?: number }).status === 409) {
            await fetchMatchState();
            setWrongFeedback(t('wordGame.snapshotStaleRetry'));
            return;
          }
          throw e;
        }
        if (!res.correct) {
          setWrongFeedback(t('wordGame.wrongGuess'));
          triggerFeedback('wrong');
          return;
        }
        triggerFeedback('correct');
        setWrongFeedback(null);
        setExtraHintRevealed(false);
        setGuess('');
        if (res.currentWord) setDeck([res.currentWord]);
        setIdx(res.yourScore);
        if (res.finished) {
          if (res.postGame) {
            setPostGamePayload(res.postGame);
          }
          try {
            const s = await apiGet<MatchState>(
              `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
              token,
            );
            if (typeof s.snapshotRev === 'number') {
              matchSnapshotRevRef.current = s.snapshotRev;
            }
            setMatchState(s);
            if (s.postGame) setPostGamePayload(s.postGame);
          } catch {
            /* socket refresh */
          }
          return;
        }
        try {
          const s = await apiGet<MatchState>(
            `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
            token,
          );
          if (typeof s.snapshotRev === 'number') {
            matchSnapshotRevRef.current = s.snapshotRev;
          }
          setMatchState(s);
        } catch {
          /* non-fatal */
        }
        return;
      }

      if (!soloSessionId) {
        setWrongFeedback(t('wordGame.soloNotReady'));
        return;
      }
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');
      const res = await apiPost<{
        correct: boolean;
        finished: boolean;
        wordIndex: number;
        targetWordCount: number;
        currentWord: WordRow | null;
        postGame?: PostGamePayload;
      }>(
        `/words/session/${encodeURIComponent(soloSessionId)}/guess`,
        {
          guess,
          latitude: presenceCoordsRef.current?.lat,
          longitude: presenceCoordsRef.current?.lng,
        },
        token,
      );
      if (!res.correct) {
        setWrongFeedback(t('wordGame.wrongGuess'));
        triggerFeedback('wrong');
        return;
      }
      triggerFeedback('correct');
      setWrongFeedback(null);
      setCorrectCount((c) => c + 1);
      setExtraHintRevealed(false);
      setGuess('');
      setSoloTargetCount(res.targetWordCount);
      if (res.currentWord) setDeck([res.currentWord]);
      setIdx(res.wordIndex);
      if (res.finished) {
        setSoloFinished(true);
        if (res.postGame) setPostGamePayload(res.postGame);
        triggerFeedback('matchWin');
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showFinished = matchState?.status === 'FINISHED' || soloFinished;
  const myResult = matchState?.participants.find((p) => p.isYou)?.result ?? null;

  const progressLineLabel =
    matchMode === 'coop'
      ? t('wordGame.coopProgress', { current: progressCurrent, total: progressTotal })
      : t('wordGame.progressLine', {
          current: progressCurrent,
          total: progressTotal,
          difficulty: difficultyShort,
        });

  const categoryLabel = currentWord
    ? t('wordGame.category', {
        category: t(`categories.${currentWord.category}`, {
          defaultValue: currentWord.category,
        }),
      })
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={t('wordGame.title')}
          onBack={leaveGame}
          backLabel={t('common.back')}
        />
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedCenter}>{t('wordGame.loadingWords')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={t('wordGame.title')}
          onBack={leaveGame}
          backLabel={t('common.back')}
        />
        <View style={styles.centerBlock}>
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={leaveGame}
            >
              <Text style={styles.primaryBtnText}>{t('common.back')}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (showFinished) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader
          colors={colors}
          title={t('wordGame.matchOver')}
          onBack={leaveGame}
          backLabel={t('common.back')}
        />
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.mutedCenter}>{t('postGame.loadingSummary')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('wordGame.title')}
        onBack={leaveGame}
        backLabel={t('common.back')}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <WordGameHud
          colors={colors}
          progressCurrent={progressCurrent}
          progressTotal={progressTotal}
          progressLabel={progressLineLabel}
          correctCount={correctCount}
          timeLeft={currentWord ? timeLeft : null}
          matchMode={matchMode}
          difficultyLabel={difficultyShort}
          ranked={matchMode === 'versus' ? Boolean(matchState?.ranked ?? rankedRoute) : false}
        />

        {matchSessionId && matchState?.deckLanguage ? (
          <Text style={styles.deckLang}>
            {t('wordMatch.deckLanguage', {
              lang: t(`wordMatch.lang.${matchState.deckLanguage.toLowerCase()}`, {
                defaultValue: matchState.deckLanguage.toUpperCase(),
              }),
            })}
          </Text>
        ) : null}

        {matchSessionId &&
        (socketStatus === 'reconnecting' || socketStatus === 'connecting') ? (
          <View style={styles.socketBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.honeyDark} />
            <Text style={styles.socketBannerText}>{t('wordMatch.socketReconnecting')}</Text>
          </View>
        ) : null}

        {matchMode === 'versus' && matchState ? (
          <WordGameVersusBoard colors={colors} participants={matchState.participants} />
        ) : null}

        {matchMode === 'coop' ? (
          <View style={styles.coopBanner}>
            <Ionicons name="people-outline" size={16} color={colors.primary} />
            <Text style={styles.coopHint}>{t('wordGame.coopHint')}</Text>
          </View>
        ) : null}

        <WordGameClueCard
          colors={colors}
          categoryLabel={categoryLabel}
          primaryClue={primaryClue}
          extraHintText={extraHintText || null}
          extraHintRevealed={extraHintRevealed}
          showExtraHintButton={showExtraHintButton}
          guess={guess}
          wrongFeedback={wrongFeedback}
          submitting={submitting}
          onGuessChange={(text) => {
            setWrongFeedback(null);
            setGuess(text);
          }}
          onRevealHint={() => setExtraHintRevealed(true)}
          onSubmit={() => void handleSubmitGuess()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      flexGrow: 1,
      gap: spacing.md,
    },
    centerBlock: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    mutedCenter: {
      color: colors.textMuted,
      marginTop: spacing.md,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.xl,
    },
    error: {
      color: colors.error,
      fontWeight: '800',
      textAlign: 'center',
      fontSize: 15,
      lineHeight: 22,
    },
    primaryBtn: {
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.textInverse, fontWeight: '900', fontSize: 15 },
    pressed: { opacity: 0.88 },
    deckLang: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: -spacing.xs,
    },
    socketBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.warningBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
    },
    socketBannerText: {
      flex: 1,
      color: colors.honeyDark,
      fontSize: 12,
      fontWeight: '800',
    },
    coopBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.primaryMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    coopHint: {
      flex: 1,
      color: colors.primaryDark,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 18,
    },
  });
}
