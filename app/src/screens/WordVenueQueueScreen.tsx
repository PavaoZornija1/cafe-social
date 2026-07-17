import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ScreenHeader from '../components/ScreenHeader';
import LinearGradientFill from '../components/ui/LinearGradientFill';
import { apiGet, apiPost } from '../lib/api';
import { triggerFeedback } from '../lib/feedback';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { toApiWordLanguage } from '../lib/wordDeckLanguage';
import type { RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'WordVenueQueue'>;

type QueuePoll = {
  status: 'idle' | 'waiting' | 'matched';
  sessionId?: string;
  position?: number;
};

export default function WordVenueQueueScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const {
    venueId,
    challengeId,
    partyId,
    mode,
    difficulty,
    wordCount,
    wordCategory,
    ranked = false,
  } = route.params;
  const { getToken, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState<QueuePoll | null>(null);
  const [enrolling, setEnrolling] = useState(true);
  const enrolledRef = useRef(false);
  const navigatedRef = useRef(false);

  const pollOnce = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) return;
    const s = await apiGet<QueuePoll>('/words/matches/queue/me', token);
    setPoll(s);
    if (s.status === 'matched' && s.sessionId && !navigatedRef.current) {
      navigatedRef.current = true;
      triggerFeedback('lobbyFound');
      navigation.replace('WordMatchWait', {
        venueId,
        challengeId,
        mode,
        difficulty,
        create: false,
        sessionId: s.sessionId,
        wordCount,
        wordCategory,
        ranked: mode === 'versus' ? ranked : undefined,
      });
    }
  }, [venueId, challengeId, mode, difficulty, wordCount, wordCategory, ranked, navigation]);

  useEffect(() => {
    if (!isLoaded || enrolledRef.current) return;
    enrolledRef.current = true;
    let cancelled = false;
    async function enroll() {
      setEnrolling(true);
      setError(null);
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error(t('qr.notAuthenticated'));

        const baseBody = {
          language: toApiWordLanguage(i18n.language),
          wordCount,
          difficulty,
          mode,
          ...(partyId ? { partyId } : {}),
          ...(wordCategory ? { category: wordCategory } : {}),
          ...(mode === 'versus' && ranked ? { ranked: true } : {}),
        };

        if (venueId) {
          const { venue, coords } = await fetchDetectedVenue();
          if (cancelled) return;
          if (!coords || venue?.id !== venueId) {
            throw new Error(t('wordMatch.needPresenceToCreate'));
          }
          await apiPost<QueuePoll>(
            '/words/matches/queue/enqueue',
            { venueId, latitude: coords.lat, longitude: coords.lng, ...baseBody },
            token,
          );
        } else {
          await apiPost<QueuePoll>('/words/matches/queue/enqueue', baseBody, token);
        }

        if (cancelled) return;
        await pollOnce();
      } catch (e) {
        enrolledRef.current = false;
        if (!cancelled) setError((e as Error).message || t('wordMatch.queueEnqueueFailed'));
      } finally {
        setEnrolling(false);
      }
    }
    void enroll();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, venueId, wordCount, difficulty, mode, wordCategory, ranked, partyId, t, i18n.language, pollOnce]);

  useEffect(() => {
    if (enrolling || error || !isLoaded) return;
    const tmr = setInterval(() => {
      void pollOnce();
    }, 2500);
    return () => clearInterval(tmr);
  }, [enrolling, error, isLoaded, pollOnce]);

  const onLeave = () => {
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (token) {
          await apiPost('/words/matches/queue/leave', {}, token);
        }
      } catch {
        /* */
      }
      enrolledRef.current = false;
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('MainTabs');
    })();
  };

  const modeLabel =
    mode === 'coop' ? t('wordLobby.modeCoop') : t('wordLobby.modeVersus');
  const statusText = enrolling
    ? t('wordMatch.queueJoining')
    : error
      ? error
      : poll?.status === 'waiting' && poll.position != null
        ? t('wordMatch.queuePosition', { n: poll.position })
        : t('wordMatch.queueSearching');

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        colors={colors}
        title={t('wordMatch.queueTitle')}
        onBack={onLeave}
        backLabel={t('common.back')}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradientFill
            from={colors.heroDark}
            to={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          />
          <View style={styles.heroBadge}>
            <Ionicons name="search-outline" size={12} color={colors.textInverse} />
            <Text style={styles.heroBadgeText}>{t('wordMatch.queueHeroKicker')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('wordMatch.queueSubtitle')}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{modeLabel}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {t('wordMatch.deckWords', { n: wordCount })}
              </Text>
            </View>
            {mode === 'versus' && ranked ? (
              <View style={[styles.heroPill, styles.heroPillRanked]}>
                <Ionicons name="ribbon-outline" size={12} color={colors.xp} />
                <Text style={[styles.heroPillText, styles.heroPillTextRanked]}>
                  {t('wordMatch.rankedBadge')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {error && !enrolling ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={onLeave}
            >
              <Text style={styles.secondaryBtnText}>{t('common.back')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.statusCard}>
            <View style={styles.spinnerWrap}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
            <Text style={styles.statusTitle}>
              {enrolling ? t('wordMatch.queueJoining') : t('wordMatch.queueSearching')}
            </Text>
            <Text style={styles.statusBody}>{statusText}</Text>
            {!enrolling && !error && !ranked ? (
              <Text style={styles.botHint}>{t('wordMatch.queueBotFillHint')}</Text>
            ) : null}
          </View>
        )}

        {!enrolling && !error ? (
          <Pressable
            style={({ pressed }) => [styles.leaveBtn, pressed && styles.pressed]}
            onPress={onLeave}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.leaveBtnText}>{t('wordMatch.queueLeave')}</Text>
          </Pressable>
        ) : null}
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
      gap: spacing.lg,
    },
    hero: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
    },
    heroGradient: { ...StyleSheet.absoluteFillObject },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    heroBadgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    heroMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    heroPill: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    heroPillRanked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    heroPillText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
    },
    heroPillTextRanked: { color: colors.honeyDark },
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    spinnerWrap: {
      width: 64,
      height: 64,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    statusBody: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      textAlign: 'center',
    },
    botHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    errorCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    errorText: {
      color: colors.error,
      fontWeight: '700',
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 20,
    },
    secondaryBtn: {
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryBtnText: { color: colors.textSecondary, fontWeight: '800', fontSize: 14 },
    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    leaveBtnText: {
      color: colors.primaryDark,
      fontWeight: '800',
      fontSize: 14,
    },
    pressed: { opacity: 0.9 },
  });
}
