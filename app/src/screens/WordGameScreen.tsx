import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useWordMatchSocket } from '../lib/useWordMatchSocket';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

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

  const soloStartedRef = useRef(false);
  const mpBootDoneRef = useRef(false);
  const submittingRef = useRef(false);
  const timeUpFiredRef = useRef(false);

  const matchMode = matchSessionId ? mode : 'solo';

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

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
              {},
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
        navigation.replace('Home');
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
        } catch {
          if (primary !== 'en') {
            start = await tryStart('en');
          } else {
            throw new Error(t('wordGame.loadError'));
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

  const finishSession = useCallback(
    async (opts: { claimChallenge: boolean }) => {
      if (!opts.claimChallenge || !challengeId || !venueId) {
        navigation.replace('Home');
        return;
      }

      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const { coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
        await apiPost<void>(
          `/venue-context/${encodeURIComponent(venueId)}/challenges/${encodeURIComponent(challengeId)}/progress`,
          {
            increment: 1,
            latitude: coords?.lat,
            longitude: coords?.lng,
          },
          token,
        );
      } catch {
        /* ignore */
      } finally {
        navigation.replace('Home');
      }
    },
    [navigation, challengeId, venueId],
  );

  const handleTimeUp = useCallback(async () => {
    if (submittingRef.current) return;
    if (timeUpFiredRef.current) return;
    timeUpFiredRef.current = true;
    try {
      if (matchMode === 'coop' && matchSessionId) {
        const token = await getTokenRef.current();
        if (!token) {
          timeUpFiredRef.current = false;
          return;
        }
        const res = await apiPost<{
          done: boolean;
          skipped?: boolean;
          newIndex: number;
          currentWord: WordRow | null;
        }>(
          `/words/matches/${encodeURIComponent(matchSessionId)}/coop-pass`,
          {
            latitude: presenceCoordsRef.current?.lat,
            longitude: presenceCoordsRef.current?.lng,
          },
          token,
        );
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
        if (token) {
          await apiPost(
            `/words/matches/${encodeURIComponent(matchSessionId)}/leave`,
            {},
            token,
          );
        }
        setGuess('');
        setWrongFeedback(t('wordGame.timeExpiredVersus'));
        try {
          const auth = await getTokenRef.current();
          if (auth) {
            const s = await apiGet<MatchState>(
              `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
              auth,
            );
            setMatchState(s);
          }
        } catch {
          /* non-fatal */
        }
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
          await finishSession({ claimChallenge: false });
        }
        return;
      }
    } catch {
      timeUpFiredRef.current = false;
      setWrongFeedback(t('wordGame.timerPassError'));
    }
  }, [matchMode, matchSessionId, soloSessionId, t, finishSession]);

  const timerWordKey = `${currentWord?.id ?? ''}|${matchSessionId ?? ''}|${soloSessionId ?? ''}|${matchMode}`;

  useEffect(() => {
    timeUpFiredRef.current = false;
  }, [timerWordKey]);

  useEffect(() => {
    const mpFinished = matchState?.status === 'FINISHED';
    if (loading || error || mpFinished || !currentWord) return undefined;
    let left = secondsPerWord(difficulty);
    setTimeLeft(left);
    const id = setInterval(() => {
      if (submittingRef.current) return;
      left -= 1;
      setTimeLeft(left);
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
        const res = await apiPost<{
          done: boolean;
          correct: boolean;
          newIndex: number;
          currentWord: WordRow | null;
        }>(
          `/words/matches/${encodeURIComponent(matchSessionId)}/coop-guess`,
          {
            guess,
            latitude: presenceCoordsRef.current?.lat,
            longitude: presenceCoordsRef.current?.lng,
          },
          token,
        );
        if (!res.correct) {
          setWrongFeedback(t('wordGame.wrongGuess'));
          return;
        }
        setWrongFeedback(null);
        setExtraHintRevealed(false);
        setGuess('');
        if (res.currentWord) setDeck([res.currentWord]);
        try {
          const s = await apiGet<MatchState>(
            `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
            token,
          );
          setMatchState(s);
        } catch {
          /* socket refresh will catch up */
        }
        return;
      }

      if (matchMode === 'versus' && matchSessionId) {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const res = await apiPost<{
          correct: boolean;
          finished: boolean;
          yourScore: number;
          currentWord: WordRow | null;
        }>(
          `/words/matches/${encodeURIComponent(matchSessionId)}/versus-guess`,
          {
            guess,
            latitude: presenceCoordsRef.current?.lat,
            longitude: presenceCoordsRef.current?.lng,
          },
          token,
        );
        if (!res.correct) {
          setWrongFeedback(t('wordGame.wrongGuess'));
          return;
        }
        setWrongFeedback(null);
        setExtraHintRevealed(false);
        setGuess('');
        if (res.currentWord) setDeck([res.currentWord]);
        setIdx(res.yourScore);
        if (res.finished) {
          try {
            const s = await apiGet<MatchState>(
              `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
              token,
            );
            setMatchState(s);
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
        return;
      }
      setWrongFeedback(null);
      setCorrectCount((c) => c + 1);
      setExtraHintRevealed(false);
      setGuess('');
      setSoloTargetCount(res.targetWordCount);
      if (res.currentWord) setDeck([res.currentWord]);
      setIdx(res.wordIndex);
      if (res.finished) {
        await finishSession({ claimChallenge: true });
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showFinished = matchState?.status === 'FINISHED';
  const myResult = matchState?.participants.find((p) => p.isYou)?.result ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Pressable onPress={leaveGame} style={styles.navBack}>
            <Text style={styles.navBackText}>{t('common.back')}</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
          <Text style={styles.sub}>{t('wordGame.loadingWords')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Pressable onPress={leaveGame} style={styles.navBack}>
            <Text style={styles.navBackText}>{t('common.back')}</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.playBtn} onPress={leaveGame}>
            <Text style={styles.playBtnText}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showFinished) {
    const won = matchMode === 'coop' || myResult === 'WIN';
    const onRematch = async () => {
      if (!matchSessionId || !matchState) return;
      setRematchBusy(true);
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const res = await apiPost<{ sessionId: string }>(
          `/words/matches/${encodeURIComponent(matchSessionId)}/rematch`,
          {},
          token,
        );
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
    };
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navHeader}>
          <Pressable onPress={leaveGame} style={styles.navBack}>
            <Text style={styles.navBackText}>{t('common.back')}</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>{t('wordGame.matchOver')}</Text>
          <Text style={styles.sub}>
            {won ? t('wordGame.matchWon') : t('wordGame.matchLost')}
          </Text>
          {matchMode === 'versus' && matchState ? (
            <View style={styles.scoresBox}>
              {matchState.participants.map((p) => (
                <Text key={p.id} style={styles.scoreRow}>
                  {p.username}: {p.score}
                  {p.result === 'WIN' ? ' 🏆' : ''}
                  {p.isYou ? ` (${t('wordGame.you')})` : ''}
                </Text>
              ))}
            </View>
          ) : null}
          {matchSessionId ? (
            <Pressable
              style={[styles.playBtn, styles.playBtnSecondary, rematchBusy && styles.playBtnDisabled]}
              disabled={rematchBusy}
              onPress={() => void onRematch()}
            >
              <Text style={styles.playBtnText}>
                {rematchBusy ? t('wordGame.rematchBusy') : t('wordGame.rematch')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.playBtn}
            onPress={() =>
              void finishSession({
                claimChallenge: !!challengeId && won,
              })
            }
          >
            <Text style={styles.playBtnText}>{t('wordGame.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navHeader}>
        <Pressable onPress={leaveGame} style={styles.navBack}>
          <Text style={styles.navBackText}>{t('common.back')}</Text>
        </Pressable>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>{t('wordGame.title')}</Text>
        <Text style={styles.sub}>
          {matchMode === 'coop'
            ? t('wordGame.coopProgress', { current: progressCurrent, total: progressTotal })
            : t('wordGame.progressLine', {
                current: progressCurrent,
                total: progressTotal,
                difficulty: difficultyShort,
              })}
        </Text>
        {matchMode === 'versus' && (matchState?.ranked ?? rankedRoute) ? (
          <Text style={styles.rankedLine}>{t('wordMatch.rankedBadge')}</Text>
        ) : null}
        {currentWord ? (
          <Text style={[styles.timerText, timeLeft <= 15 ? styles.timerUrgent : null]}>
            {t('wordGame.timeLeft', { s: Math.max(0, timeLeft) })}
          </Text>
        ) : null}
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
          <Text style={styles.socketBanner}>{t('wordMatch.socketReconnecting')}</Text>
        ) : null}
        {matchMode === 'versus' && matchState ? (
          <View style={styles.versusBar}>
            {matchState.participants.map((p) => (
              <Text key={p.id} style={styles.versusRow}>
                {p.username}: {p.score}
                {p.isYou ? ` (${t('wordGame.you')})` : ''}
              </Text>
            ))}
          </View>
        ) : null}
        {matchMode === 'coop' ? (
          <Text style={styles.coopHint}>{t('wordGame.coopHint')}</Text>
        ) : null}

        <View style={styles.wordCard}>
          <Text style={styles.wordTitle}>{t('wordGame.guessTitle')}</Text>
          <Text style={styles.categoryText}>
            {currentWord
              ? t('wordGame.category', {
                  category: t(`categories.${currentWord.category}`, {
                    defaultValue: currentWord.category,
                  }),
                })
              : ''}
          </Text>

          <Text style={styles.clueLabel}>{t('wordGame.clueLabel')}</Text>
          <Text style={styles.clueBody}>{primaryClue}</Text>
          {showExtraHintButton && extraHintRevealed ? (
            <Text style={styles.hint}>{extraHintText}</Text>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder={t('wordGame.guessPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={guess}
            onChangeText={(text) => {
              setWrongFeedback(null);
              setGuess(text);
            }}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!submitting}
          />
          {wrongFeedback ? <Text style={styles.wrongHint}>{wrongFeedback}</Text> : null}

          {showExtraHintButton ? (
            <View style={styles.row}>
              <Pressable
                style={styles.btn}
                onPress={() => setExtraHintRevealed(true)}
                disabled={extraHintRevealed}
              >
                <Text style={styles.btnText}>
                  {extraHintRevealed ? t('wordGame.extraHintShown') : t('wordGame.showExtraHint')}
                </Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                onPress={() => void handleSubmitGuess()}
                disabled={submitting}
              >
                <Text style={styles.btnPrimaryText}>
                  {submitting ? t('wordGame.checking') : t('wordGame.submit')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.btnPrimaryFull}
              onPress={() => void handleSubmitGuess()}
              disabled={submitting}
            >
              <Text style={styles.btnPrimaryText}>
                {submitting ? t('wordGame.checking') : t('wordGame.submit')}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.score}>{t('wordGame.correct', { count: correctCount })}</Text>
          <Pressable style={styles.secondaryBtn} onPress={leaveGame}>
            <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBack: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  navBackText: { color: colors.textSecondary, fontWeight: '600' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.textMuted, marginTop: 8, fontSize: 13, textAlign: 'center' },
  rankedLine: {
    marginTop: 6,
    color: colors.honeyDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  timerText: {
    color: colors.textSecondary,
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  timerUrgent: { color: colors.error },
  deckLang: { color: colors.textMuted, marginTop: 4, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  socketBanner: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.warningBg,
    color: colors.honeyDark,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    overflow: 'hidden',
  },
  error: { color: colors.error, fontWeight: '800', textAlign: 'center' },
  coopHint: { color: colors.honeyDark, fontSize: 12, marginTop: 6, fontWeight: '700' },
  versusBar: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  versusRow: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginVertical: 2 },
  scoresBox: { marginTop: 12, alignSelf: 'stretch', gap: 6 },
  scoreRow: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  wordCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  wordTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  categoryText: { color: colors.honeyDark, marginTop: 6, fontWeight: '800', fontSize: 12 },
  clueLabel: { color: colors.textMuted, marginTop: 14, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  clueBody: { color: colors.textSecondary, marginTop: 6, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  hint: { color: colors.honey, marginTop: 12, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  wrongHint: { color: '#fbbf24', marginTop: 8, fontSize: 13, fontWeight: '700' },
  input: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnText: { color: colors.honeyDark, fontWeight: '900' },
  btnPrimary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.textInverse, fontWeight: '900' },
  btnPrimaryFull: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  score: { color: colors.text, fontWeight: '900' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textMuted, fontWeight: '900' },
  playBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playBtnText: { color: colors.text, fontWeight: '900' },
  playBtnSecondary: {
    backgroundColor: colors.honeyMuted,
    borderColor: colors.primary,
  },
  playBtnDisabled: { opacity: 0.6 },

    });
}
