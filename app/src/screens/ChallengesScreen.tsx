import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import { fetchDetectedVenue } from '../lib/venueDetectClient';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Challenges'>;

type Venue = { id: string; name: string; isPremium: boolean };

type VenueChallenge = {
  id: string;
  title: string;
  description: string | null;
  rewardVenueSpecific: boolean;
  locationRequired: boolean;
  targetCount: number;
  progressCount: number;
  isCompleted: boolean;
  resetsWeekly?: boolean;
  rewardPerkId: string | null;
  rewardTitle: string | null;
};

export default function ChallengesScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const routeVenueId = route.params?.venueId;
  const routeVenueName = route.params?.venueName;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<VenueChallenge[]>([]);
  const [progressingId, setProgressingId] = useState<string | null>(null);

  const challengesRef = useRef(challenges);
  challengesRef.current = challenges;

  const fetchChallenges = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const hasData = challengesRef.current.length > 0;
      if (mode === 'initial' && !hasData) {
        setInitializing(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      }
      setError(null);

      try {
        if (!isLoaded) return;

        let activeVenue: Venue | null = null;

        if (routeVenueId) {
          activeVenue = {
            id: routeVenueId,
            name: routeVenueName?.trim() || routeVenueId,
            isPremium: false,
          };
        } else {
          const { venue: detected } = await fetchDetectedVenue();
          activeVenue = detected;
        }

        setVenue(activeVenue);

        if (!activeVenue) {
          setChallenges([]);
          return;
        }

        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');

        const list = await apiGet<VenueChallenge[]>(
          `/venue-context/${encodeURIComponent(activeVenue.id)}/challenges`,
          token,
        );
        setChallenges(Array.isArray(list) ? list : []);
      } catch (e) {
        setError((e as Error).message || tRef.current('challenges.loadError'));
        if (!hasData) setChallenges([]);
      } finally {
        setInitializing(false);
        setRefreshing(false);
      }
    },
    [isLoaded, routeVenueId, routeVenueName],
  );

  useEffect(() => {
    if (!isLoaded) return;
    void fetchChallenges('initial');
  }, [isLoaded, fetchChallenges]);

  useFocusEffect(
    useCallback(() => {
      if (challengesRef.current.length > 0 || venue) {
        void fetchChallenges('refresh');
      }
    }, [fetchChallenges, venue]),
  );

  const handleRefresh = useCallback(() => {
    void fetchChallenges(challengesRef.current.length > 0 ? 'refresh' : 'initial');
  }, [fetchChallenges]);

  const increment = async (challengeId: string) => {
    if (!venue) return;
    if (!isLoaded) return;

    setProgressingId(challengeId);
    setError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) throw new Error('Not authenticated');

      const ch = challenges.find((x) => x.id === challengeId);
      const needHigh = Boolean(ch?.locationRequired || ch?.rewardVenueSpecific);
      const { coords } = await fetchDetectedVenue({
        locationAccuracy: needHigh ? 'high' : 'balanced',
      });

      await apiPost<void>(
        `/venue-context/${encodeURIComponent(venue.id)}/challenges/${encodeURIComponent(challengeId)}/progress`,
        { increment: 1, latitude: coords?.lat, longitude: coords?.lng },
        token,
      );

      const list = await apiGet<VenueChallenge[]>(
        `/venue-context/${encodeURIComponent(venue.id)}/challenges`,
        token,
      );
      setChallenges(Array.isArray(list) ? list : []);
    } catch (e) {
      setError((e as Error).message || tRef.current('challenges.loadError'));
    } finally {
      setProgressingId(null);
    }
  };

  const heroSubtitle = venue
    ? t('challenges.subtitleVenue', { venue: venue.name })
    : t('challenges.subtitleEmpty');

  const showInitialSpinner = initializing && challenges.length === 0 && !error;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
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
          <Text style={styles.title}>{t('challenges.title')}</Text>
          <Pressable
            onPress={handleRefresh}
            disabled={refreshing}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('challenges.refreshA11y')}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="trophy-outline" size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>{t('challenges.heroTitle')}</Text>
          <Text style={styles.heroSub}>{heroSubtitle}</Text>
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        {showInitialSpinner ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.mutedCenter}>{t('challenges.loading')}</Text>
          </View>
        ) : challenges.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="flag-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('challenges.empty')}</Text>
          </View>
        ) : (
          challenges.map((c) => {
            const progressPct =
              c.targetCount > 0
                ? Math.min(1, Math.max(0, c.progressCount / c.targetCount))
                : 0;
            const atVenue = c.locationRequired || c.rewardVenueSpecific;

            return (
              <View key={c.id} style={[styles.card, c.isCompleted && styles.cardDone]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, c.isCompleted && styles.cardIconDone]}>
                    <Ionicons
                      name={c.isCompleted ? 'checkmark-circle' : 'flash-outline'}
                      size={22}
                      color={c.isCompleted ? colors.success : colors.textInverse}
                    />
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <View
                      style={[
                        styles.badge,
                        c.isCompleted ? styles.badgeDone : styles.badgeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          c.isCompleted ? styles.badgeTextDone : styles.badgeTextActive,
                        ]}
                      >
                        {c.isCompleted ? t('challenges.done') : t('challenges.inProgress')}
                      </Text>
                    </View>
                  </View>
                </View>

                {c.description ? <Text style={styles.cardDesc}>{c.description}</Text> : null}

                <View style={styles.progressBlock}>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressLabel}>
                      {t('challenges.progress', {
                        current: c.progressCount,
                        target: c.targetCount,
                      })}
                    </Text>
                    <Text style={styles.progressPct}>{Math.round(progressPct * 100)}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        c.isCompleted && styles.progressFillDone,
                        { width: `${Math.round(progressPct * 100)}%` },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons
                    name={atVenue ? 'location-outline' : 'home-outline'}
                    size={14}
                    color={atVenue ? colors.honeyDark : colors.textMuted}
                  />
                  <Text style={[styles.cardHint, atVenue && styles.cardHintVenue]}>
                    {atVenue ? t('challenges.requiresAtCafe') : t('challenges.worksFromHome')}
                  </Text>
                </View>

                {c.resetsWeekly ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={colors.honey} />
                    <Text style={styles.cardWeekly}>{t('challenges.weekly')}</Text>
                  </View>
                ) : null}

                {c.rewardTitle ? (
                  <View style={styles.rewardRow}>
                    <Ionicons name="gift-outline" size={14} color={colors.xp} />
                    <Text style={styles.cardReward}>
                      {t('challenges.rewardLine', { title: c.rewardTitle })}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={Boolean(progressingId) || c.isCompleted}
                  onPress={() => void increment(c.id)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    c.isCompleted && styles.actionBtnDone,
                    pressed && styles.pressed,
                    (Boolean(progressingId) || c.isCompleted) && styles.actionBtnDisabled,
                  ]}
                >
                  <Text style={[styles.actionText, c.isCompleted && styles.actionTextDone]}>
                    {progressingId === c.id
                      ? t('challenges.updating')
                      : c.isCompleted
                        ? t('challenges.completedCta')
                        : t('challenges.progressCta')}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
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
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    pressed: { opacity: 0.88 },
    hero: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 20,
      fontWeight: '900',
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    errorBanner: {
      color: colors.error,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.md,
      fontWeight: '600',
    },
    centerBlock: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
    },
    mutedCenter: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyCard: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      fontWeight: '600',
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.xl,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    cardDone: {
      borderColor: colors.success,
      backgroundColor: colors.successMuted,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardIconDone: { backgroundColor: colors.successMuted },
    cardHeaderText: { flex: 1, gap: spacing.sm },
    cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900', lineHeight: 22 },
    badge: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
    },
    badgeActive: { backgroundColor: colors.primaryMuted },
    badgeDone: { backgroundColor: colors.successMuted },
    badgeText: { fontSize: 11, fontWeight: '800' },
    badgeTextActive: { color: colors.primaryDark },
    badgeTextDone: { color: colors.success },
    cardDesc: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '500' },
    progressBlock: { gap: spacing.xs, marginTop: spacing.xs },
    progressMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    progressPct: { color: colors.xp, fontSize: 13, fontWeight: '900' },
    progressTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
    },
    progressFillDone: { backgroundColor: colors.success },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    cardHint: { flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 17 },
    cardHintVenue: { color: colors.honeyDark, fontWeight: '700' },
    cardWeekly: { flex: 1, color: colors.honey, fontSize: 12, fontWeight: '700', lineHeight: 17 },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    cardReward: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    actionBtn: {
      marginTop: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.lg,
      alignItems: 'center',
    },
    actionBtnDone: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    actionBtnDisabled: { opacity: 0.55 },
    actionText: { color: colors.textInverse, fontWeight: '900', fontSize: 14 },
    actionTextDone: { color: colors.textMuted },
  });
}
