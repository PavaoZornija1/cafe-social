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

type Props = NativeStackScreenProps<RootStackParamList, 'WordGame'>;

type WordRow = {
  id: string;
  text: string;
  language: string;
  category: string;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
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
  venueId?: string | null;
  hostPlayerId: string;
  inviteCode: string | null;
  targetWordCount: number;
  sharedWordIndex: number;
  deckLanguage?: string;
  deckCategory?: string | null;
  participants: MatchParticipant[];
};

function normalizeGuess(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export default function WordGameScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    difficulty,
    sessionWordsCount = 5,
    mode = 'solo',
    matchSessionId,
    wordCategory,
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
  const [matchState, setMatchState] = useState<MatchState | null>(null);

  const deckLoadedRef = useRef(false);

  const matchMode = matchSessionId ? mode : 'solo';
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

  const currentWord =
    matchMode === 'coop' ? deck[coopIdx] : deck[versusOrSoloIdx];

  /** Always shown — the main written clue (not just a broad category). */
  const primaryClue = useMemo(() => {
    if (!currentWord) return '';
    const s = currentWord.sentenceHint?.trim();
    if (s) return s;
    if (currentWord.wordHints?.length) return currentWord.wordHints.join(', ');
    return currentWord.emojiHints.join(' ');
  }, [currentWord]);

  /** Optional second line: word list (normal) or emojis (hard). */
  const extraHintText = useMemo(() => {
    if (!currentWord) return '';
    if (difficulty === 'normal') return currentWord.wordHints.join(', ');
    if (difficulty === 'hard') return currentWord.emojiHints.join(' ');
    return '';
  }, [currentWord, difficulty]);

  const showExtraHintButton =
    difficulty !== 'easy' && extraHintText.length > 0 && primaryClue !== extraHintText;

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

  const progressCurrent =
    matchMode === 'coop' ? Math.min(coopIdx + 1, Math.max(deck.length, 1)) : idx + 1;
  const progressTotal = Math.max(deck.length, 1);

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

  const { socketStatus } = useWordMatchSocket({
    sessionId: matchSessionId ?? null,
    enabled: !!matchSessionId && isLoaded,
    getToken: async () => (await getTokenRef.current?.()) ?? null,
    onRefresh: fetchMatchState,
    fallbackPollMs: 30000,
  });

  /** Solo deck */
  useEffect(() => {
    if (matchSessionId) return;
    let cancelled = false;

    async function run() {
      if (!isLoaded) return;
      if (deckLoadedRef.current) return;
      deckLoadedRef.current = true;

      try {
        setLoading(true);
        setError(null);

        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');

        const primary = toApiWordLanguage(i18n.language);
        let venueQs = '';
        if (!globalSolo) {
          if (!venueId) throw new Error(t('wordGame.needVenuePresence'));
          const { venue, coords } = await fetchDetectedVenue({ locationAccuracy: 'high' });
          if (!coords || venue?.id !== venueId) {
            throw new Error(t('wordGame.needVenuePresence'));
          }
          presenceCoordsRef.current = coords;
          venueQs = `&venueId=${encodeURIComponent(venueId)}&lat=${encodeURIComponent(String(coords.lat))}&lng=${encodeURIComponent(String(coords.lng))}`;
        } else {
          presenceCoordsRef.current = null;
        }
        const globalQs = globalSolo ? '&globalPlay=1' : '';
        const catQs = wordCategory ? `&category=${encodeURIComponent(wordCategory)}` : '';
        let res = await apiGet<{ words: WordRow[] }>(
          `/words/session?language=${encodeURIComponent(primary)}&count=${encodeURIComponent(String(sessionWordsCount))}${globalQs}${venueQs}${catQs}`,
          token,
        );
        if (cancelled) return;
        if (!res.words?.length && primary !== 'en') {
          res = await apiGet<{ words: WordRow[] }>(
            `/words/session?language=en&count=${encodeURIComponent(String(sessionWordsCount))}${globalQs}${venueQs}${catQs}`,
            token,
          );
        }
        if (cancelled) return;
        if (!res.words?.length) {
          setError(t('wordGame.emptyDeck'));
          setDeck([]);
          return;
        }
        setDeck(res.words);
      } catch (e) {
        if (cancelled) return;
        deckLoadedRef.current = false;
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
    t,
    matchSessionId,
    i18n.language,
    globalSolo,
    venueId,
    wordCategory,
  ]);

  /** Multiplayer deck (match must be ACTIVE) */
  useEffect(() => {
    const sid = matchSessionId;
    if (!sid || !isLoaded) return;
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const s = await apiGet<MatchState>(
          `/words/matches/${encodeURIComponent(sid as string)}/state`,
          token,
        );
        if (cancelled) return;
        setMatchState(s);
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
        const res = await apiGet<{ words: WordRow[] }>(
          `/words/matches/${encodeURIComponent(sid as string)}/deck${deckQs}`,
          token,
        );
        if (cancelled) return;
        if (!res.words?.length) {
          setError(t('wordGame.matchDeckError'));
          setDeck([]);
          return;
        }
        setDeck(res.words);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || t('wordGame.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [matchSessionId, isLoaded, t]);

  const finishSession = async (opts: { claimChallenge: boolean }) => {
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
  };

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
        if (res.done && token) {
          try {
            const s = await apiGet<MatchState>(
              `/words/matches/${encodeURIComponent(matchSessionId)}/state`,
              token,
            );
            setMatchState(s);
          } catch {
            /* socket refresh will catch up */
          }
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
        setIdx(res.yourScore);
        return;
      }

      const isCorrect = normalizeGuess(guess) === normalizeGuess(currentWord.text);
      if (!isCorrect) {
        setWrongFeedback(t('wordGame.wrongGuess'));
        return;
      }

      setWrongFeedback(null);
      setCorrectCount((c) => c + 1);
      setExtraHintRevealed(false);
      setGuess('');

      const nextIdx = idx + 1;
      if (nextIdx >= deck.length) {
        await finishSession({ claimChallenge: true });
        return;
      }
      setIdx(nextIdx);
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
          {difficulty === 'easy' ? (
            <Text style={styles.easyHintNote}>{t('wordGame.easyNoExtra')}</Text>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder={t('wordGame.guessPlaceholder')}
            placeholderTextColor="#6b7280"
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
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
    backgroundColor: '#111827',
  },
  navBackText: { color: '#cbd5e1', fontWeight: '600' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: '#9ca3af', marginTop: 8, fontSize: 13, textAlign: 'center' },
  deckLang: { color: '#6b7280', marginTop: 4, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  socketBanner: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#422006',
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    overflow: 'hidden',
  },
  error: { color: '#f87171', fontWeight: '800', textAlign: 'center' },
  coopHint: { color: '#a5b4fc', fontSize: 12, marginTop: 6, fontWeight: '700' },
  versusBar: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  versusRow: { color: '#e5e7eb', fontSize: 12, fontWeight: '700', marginVertical: 2 },
  scoresBox: { marginTop: 12, alignSelf: 'stretch', gap: 6 },
  scoreRow: { color: '#d1d5db', fontSize: 14, fontWeight: '700' },
  wordCard: {
    marginTop: 18,
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 16,
  },
  wordTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  categoryText: { color: '#a5b4fc', marginTop: 6, fontWeight: '800', fontSize: 12 },
  clueLabel: { color: '#9ca3af', marginTop: 14, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  clueBody: { color: '#e5e7eb', marginTop: 6, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  easyHintNote: { color: '#6b7280', marginTop: 8, fontSize: 12 },
  hint: { color: '#c4b5fd', marginTop: 12, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  wrongHint: { color: '#fbbf24', marginTop: 8, fontSize: 13, fontWeight: '700' },
  input: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0b1220',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
  },
  btnText: { color: '#a5b4fc', fontWeight: '900' },
  btnPrimary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '900' },
  btnPrimaryFull: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  score: { color: '#fff', fontWeight: '900' },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  secondaryBtnText: { color: '#9ca3af', fontWeight: '900' },
  playBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  playBtnText: { color: '#fff', fontWeight: '900' },
  playBtnSecondary: {
    backgroundColor: '#312e81',
    borderColor: '#4c1d95',
  },
  playBtnDisabled: { opacity: 0.6 },
});
