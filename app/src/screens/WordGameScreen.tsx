import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';

type Props = NativeStackScreenProps<RootStackParamList, 'WordGame'>;
type Difficulty = 'easy' | 'normal' | 'hard';

type WordRow = {
  id: string;
  text: string;
  language: string;
  category: string;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
};

function normalizeGuess(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export default function WordGameScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { venueId, challengeId, difficulty, sessionWordsCount = 5 } = route.params;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<WordRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState('');
  const [hintRevealed, setHintRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const currentWord = deck[idx];

  const hintText = useMemo(() => {
    if (!currentWord) return '';
    if (difficulty === 'easy') return currentWord.sentenceHint;
    if (difficulty === 'normal') return currentWord.wordHints.join(', ');
    return currentWord.emojiHints.join(' ');
  }, [currentWord, difficulty]);

  const difficultyShort = useMemo(() => {
    if (difficulty === 'easy') return t('wordLobby.easy');
    if (difficulty === 'normal') return t('wordLobby.normal');
    return t('wordLobby.hard');
  }, [difficulty, t]);

  const deckLoadedRef = useRef(false);

  useEffect(() => {
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

        const res = await apiGet<{ words: WordRow[] }>(
          `/words/session?language=en&count=${encodeURIComponent(String(sessionWordsCount))}`,
          token,
        );
        if (cancelled) return;
        setDeck(res.words);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message || t('wordGame.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, sessionWordsCount, t]);

  const finishSession = async (solvedAtLeastOne: boolean) => {
    // MVP: only update challenge when the player actually solved something.
    if (!challengeId || !solvedAtLeastOne) {
      navigation.replace('Home');
      return;
    }

    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      // For MVP, the server enforces locationRequired presence using detected venue id.
      // We'll fetch the current detected venue context from the backend.
      const detected = await fetchDetectedVenue();

      await apiPost<void>(
        `/venue-context/${encodeURIComponent(venueId)}/challenges/${encodeURIComponent(challengeId)}/progress`,
        { increment: 1, detectedVenueId: detected?.id ?? null },
        token,
      );
    } catch {
      // MVP: ignore claim failure; player can try again later in Challenges.
    } finally {
      navigation.replace('Home');
    }
  };

  const handleSubmitGuess = async () => {
    if (!currentWord) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      const isCorrect = normalizeGuess(guess) === normalizeGuess(currentWord.text);
      if (!isCorrect) return;

      setCorrectCount((c) => c + 1);
      setHintRevealed(false);
      setGuess('');

      const nextIdx = idx + 1;
      if (nextIdx >= deck.length) {
        await finishSession(true);
        return;
      }

      setIdx(nextIdx);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
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
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.playBtn} onPress={() => navigation.replace('Home')}>
            <Text style={styles.playBtnText}>{t('wordGame.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('wordGame.title')}</Text>
        <Text style={styles.sub}>
          {t('wordGame.progressLine', { current: idx + 1, total: deck.length, difficulty: difficultyShort })}
        </Text>

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

          {hintRevealed ? <Text style={styles.hint}>{hintText}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder={t('wordGame.guessPlaceholder')}
            placeholderTextColor="#6b7280"
            value={guess}
            onChangeText={setGuess}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!submitting}
          />

          <View style={styles.row}>
            <Pressable
              style={styles.btn}
              onPress={() => setHintRevealed(true)}
              disabled={hintRevealed}
            >
              <Text style={styles.btnText}>{hintRevealed ? 'Hint shown' : 'Bot hint'}</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={handleSubmitGuess} disabled={submitting}>
              <Text style={styles.btnPrimaryText}>{submitting ? 'Checking…' : 'Submit'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.score}>{t('wordGame.correct', { count: correctCount })}</Text>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.replace('Home')}
          >
            <Text style={styles.secondaryBtnText}>{t('wordGame.exit')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050816' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  sub: { color: '#9ca3af', marginTop: 8, fontSize: 13 },
  error: { color: '#f87171', fontWeight: '800', textAlign: 'center' },
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
  hint: { color: '#c4b5fd', marginTop: 12, fontSize: 13, lineHeight: 18, fontWeight: '700' },
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
});

