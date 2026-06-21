import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { emitPlatformQuestProgressChanged } from '../lib/platformQuestEvents';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyWord'>;

type DailyHints = {
  answerLength: number;
  sentenceHint?: string;
  wordHints?: string[];
  emojiHints?: string[];
};

type DailyState = {
  dayKey: string;
  scope: 'global' | 'venue';
  venueId?: string;
  language: string;
  solved: boolean;
  attempts: number;
  maxAttempts: number;
  answerLength: number;
  streak: number;
  lastSolvedDayKey: string | null;
  word?: string;
  hints?: DailyHints;
};

type VenueGps = { venueId: string; lat: number; lng: number };

export default function DailyWordScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [bootstrapping, setBootstrapping] = useState(true);
  const [scope, setScope] = useState<'global' | 'venue'>('venue');
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [venueGps, setVenueGps] = useState<VenueGps | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DailyState | null>(null);
  const [guess, setGuess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBootstrapping(true);
      try {
        const { venue, coords } = await fetchDetectedVenue();
        const gps =
          venue && coords && venue.id
            ? { venueId: venue.id, lat: coords.lat, lng: coords.lng }
            : null;

        const token = await getTokenRef.current();
        let subActive = false;
        if (token) {
          const summary = await apiGet<{ subscriptionActive?: boolean }>(
            '/players/me/summary',
            token,
          );
          subActive = summary.subscriptionActive ?? false;
        }

        if (cancelled) return;

        setVenueGps(gps);
        setSubscriptionActive(subActive);
        if (subActive) {
          setScope('global');
        } else if (gps) {
          setScope('venue');
        } else {
          setScope('global');
        }
      } catch {
        if (!cancelled) {
          setVenueGps(null);
          setSubscriptionActive(false);
          setScope('venue');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDaily = useCallback(async () => {
    if (bootstrapping) return;

    setLoading(true);
    setError(null);

    try {
      if (scope === 'venue' && !venueGps) {
        setState(null);
        setError(t('dailyWord.needVenue'));
        return;
      }
      if (scope === 'global' && !subscriptionActive) {
        setState(null);
        setError(t('dailyWord.globalRequiresSub'));
        return;
      }

      const token = await getTokenRef.current();
      if (!token) throw new Error(t('dailyWord.notSignedIn'));

      const qs = new URLSearchParams();
      qs.set('scope', scope);
      qs.set('language', toApiWordLanguage(i18n.language));
      if (scope === 'venue' && venueGps) {
        qs.set('venueId', venueGps.venueId);
        qs.set('lat', String(venueGps.lat));
        qs.set('lng', String(venueGps.lng));
      }

      const daily = await apiGet<DailyState>(`/words/daily?${qs.toString()}`, token);
      setState(daily);
      setGuess('');
    } catch (e) {
      setState(null);
      setError((e as Error).message || t('dailyWord.loadError'));
    } finally {
      setLoading(false);
    }
  }, [bootstrapping, scope, subscriptionActive, venueGps, t, i18n.language]);

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  const onSubmit = async () => {
    if (!state || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error(t('dailyWord.notSignedIn'));
      const body: Record<string, unknown> = {
        scope,
        language: toApiWordLanguage(i18n.language),
        guess: guess.trim(),
      };
      if (scope === 'venue' && venueGps) {
        body.venueId = venueGps.venueId;
        body.latitude = venueGps.lat;
        body.longitude = venueGps.lng;
      }
      const res = await apiPost<{
        correct: boolean;
        solved: boolean;
        attempts: number;
        maxAttempts: number;
        word?: string;
        streak: number;
        hints?: DailyHints;
      }>('/words/daily/guess', body, token);
      setState((prev) =>
        prev
          ? {
              ...prev,
              solved: res.solved,
              attempts: res.attempts,
              word: res.word ?? prev.word,
              streak: res.streak,
              hints: res.hints ?? prev.hints,
              answerLength: res.hints?.answerLength ?? prev.answerLength,
            }
          : prev,
      );
      if (res.solved) {
        emitPlatformQuestProgressChanged();
      }
      setGuess('');
    } catch (e) {
      setError((e as Error).message || t('dailyWord.guessError'));
    } finally {
      setSubmitting(false);
    }
  };

  const canVenue = Boolean(venueGps);
  const canGlobalDaily = subscriptionActive;
  const showSpinner = bootstrapping || loading;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t('dailyWord.title')}</Text>
            <View style={styles.iconBtnSpacer} />
          </View>

          <View style={styles.scopeRow}>
            <Pressable
              style={[
                styles.scopeBtn,
                scope === 'global' && styles.scopeBtnOn,
                !canGlobalDaily && styles.scopeDisabled,
              ]}
              disabled={!canGlobalDaily || bootstrapping}
              onPress={() => setScope('global')}
            >
              <Text style={[styles.scopeText, scope === 'global' && styles.scopeTextOn]}>
                {t('dailyWord.scopeGlobal')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.scopeBtn,
                scope === 'venue' && styles.scopeBtnOn,
                !canVenue && styles.scopeDisabled,
              ]}
              disabled={!canVenue || bootstrapping}
              onPress={() => setScope('venue')}
            >
              <Text style={[styles.scopeText, scope === 'venue' && styles.scopeTextOn]}>
                {t('dailyWord.scopeVenue')}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.modeBlurb}>{t('dailyWord.wordRoomsHint')}</Text>
          <Text style={styles.hardModeBlurb}>{t('dailyWord.hardModeBlurb')}</Text>

          {showSpinner ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : error && !state ? (
            <View style={styles.messageCard}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : state ? (
            <View style={styles.body}>
              <View style={styles.statsCard}>
                <Text style={styles.meta}>
                  {t('dailyWord.day', { day: state.dayKey })} ·{' '}
                  {t('dailyWord.streak', { n: state.streak })}
                </Text>
                <Text style={styles.hint}>
                  {t('dailyWord.answerLength', {
                    n: state.hints?.answerLength ?? state.answerLength,
                  })}
                </Text>
                <Text style={styles.attempts}>
                  {t('dailyWord.attempts', { current: state.attempts, max: state.maxAttempts })}
                </Text>
              </View>

              {state.hints?.sentenceHint ? (
                <View style={styles.hintCard}>
                  <Text style={styles.progressiveHint}>
                    <Text style={styles.hintLabel}>{t('dailyWord.hintSentence')}</Text>
                    {state.hints.sentenceHint}
                  </Text>
                </View>
              ) : null}
              {state.hints?.wordHints?.length ? (
                <View style={styles.hintCard}>
                  <Text style={styles.progressiveHint}>
                    <Text style={styles.hintLabel}>{t('dailyWord.hintWords')}</Text>
                    {state.hints.wordHints.join(', ')}
                  </Text>
                </View>
              ) : null}
              {state.hints?.emojiHints?.length ? (
                <View style={styles.hintCard}>
                  <Text style={styles.progressiveHint}>
                    <Text style={styles.hintLabel}>{t('dailyWord.hintEmoji')}</Text>
                    {state.hints.emojiHints.join(' ')}
                  </Text>
                </View>
              ) : null}

              {state.solved ? (
                <View style={styles.resultCard}>
                  <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                  <Text style={styles.win}>{t('dailyWord.solved', { word: state.word ?? '—' })}</Text>
                </View>
              ) : state.attempts >= state.maxAttempts ? (
                <View style={styles.resultCard}>
                  <Text style={styles.lose}>{t('dailyWord.outOfAttempts')}</Text>
                </View>
              ) : (
                <View style={styles.guessCard}>
                  <TextInput
                    style={styles.input}
                    value={guess}
                    onChangeText={setGuess}
                    placeholder={t('dailyWord.placeholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                    returnKeyType="done"
                    onSubmitEditing={() => void onSubmit()}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.submit,
                      (submitting || !guess.trim()) && styles.submitDisabled,
                      pressed && !submitting && guess.trim() && styles.pressed,
                    ]}
                    onPress={() => void onSubmit()}
                    disabled={submitting || !guess.trim()}
                  >
                    <Text style={styles.submitText}>
                      {submitting ? t('common.loading') : t('dailyWord.submit')}
                    </Text>
                  </Pressable>
                </View>
              )}

              {error ? <Text style={styles.inlineError}>{error}</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconBtnSpacer: { width: 44 },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    scopeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    scopeBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    scopeBtnOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scopeDisabled: { opacity: 0.45 },
    scopeText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
    scopeTextOn: { color: colors.textInverse },
    modeBlurb: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: spacing.sm,
    },
    hardModeBlurb: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: spacing.lg,
      fontStyle: 'italic',
    },
    center: { paddingVertical: spacing.xxl, alignItems: 'center' },
    messageCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    body: { gap: spacing.md },
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    hintCard: {
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(37, 97, 233, 0.2)',
      padding: spacing.lg,
    },
    guessCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    meta: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    hint: { color: colors.text, fontSize: 16, fontWeight: '700' },
    progressiveHint: { color: colors.text, fontSize: 14, lineHeight: 20 },
    hintLabel: { color: colors.primary, fontWeight: '800' },
    attempts: { color: colors.xp, fontSize: 14, fontWeight: '700' },
    input: {
      backgroundColor: colors.bgElevated,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    submit: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      alignItems: 'center',
    },
    submitDisabled: { opacity: 0.5 },
    submitText: { color: colors.textInverse, fontWeight: '800', fontSize: 16 },
    resultCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    win: { flex: 1, color: colors.success, fontSize: 17, fontWeight: '700' },
    lose: { color: colors.error, fontSize: 16, fontWeight: '600' },
    error: { color: colors.error, fontSize: 14, lineHeight: 20, fontWeight: '600' },
    inlineError: { color: colors.error, fontSize: 14, marginTop: spacing.xs },
    pressed: { opacity: 0.92 },
  });
}
