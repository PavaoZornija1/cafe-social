import { useAuth } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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

import { apiGet } from '../lib/api';
import { isLikelyNetworkFailure } from '../lib/isNetworkError';
import type { MeSummaryDto } from '../lib/meSummary';
import type { RootStackParamList } from '../navigation/type';
import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'DiscoverHub'>;

type Engagement = {
  visitsThisWeek: number;
  distinctVenuesVisitedLast30Days: number;
  badges: string[];
};

type ActionCardProps = {
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  borderColor: string;
  title: string;
  description: string;
  onPress: () => void;
  a11y: string;
};

function DiscoverActionCard({
  colors,
  styles,
  icon,
  iconBg,
  borderColor,
  title,
  description,
  onPress,
  a11y,
}: ActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderColor }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <View style={styles.cardHeaderRow}>
        <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={24} color={colors.textInverse} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.chevronCircle}>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

export default function DiscoverHubScreen({ navigation }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [summary, setSummary] = useState<MeSummaryDto | null>(null);
  const [subscribers, setSubscribers] = useState<{ id: string; username: string }[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);
    setLoadErr(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setEngagement(null);
        setSummary(null);
        return;
      }
      const [eng, sum, subs] = await Promise.all([
        apiGet<Engagement>('/players/me/engagement', token).catch(() => null),
        apiGet<MeSummaryDto>('/players/me/summary', token).catch(() => null),
        apiGet<MeSummaryDto>('/players/me/summary', token)
          .then((s) =>
            s.subscriptionActive
              ? apiGet<{ id: string; username: string }[]>(
                  '/social/discover/subscribers',
                  token,
                ).catch(() => [])
              : Promise.resolve([]),
          )
          .catch(() => []),
      ]);
      setEngagement(eng);
      setSummary(sum);
      setSubscribers(Array.isArray(subs) ? subs : []);
    } catch (e) {
      setLoadErr(
        isLikelyNetworkFailure(e)
          ? t('home.venueErrorNetwork')
          : (e as Error).message || t('discoverHub.loadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [isLoaded, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const badgeLabel = useCallback(
    (key: string): string => {
      if (key === 'regular_this_week') return t('home.badgeRegularWeek');
      if (key === 'venue_explorer') return t('home.badgeVenueExplorer');
      return key;
    },
    [t],
  );

  const xpProgress =
    summary?.nextTierXpThreshold != null && summary.nextTierXpThreshold > 0
      ? Math.min(1, summary.xp / summary.nextTierXpThreshold)
      : null;

  return (
    <SafeAreaView style={styles.safe}>
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
          <Text style={styles.title}>{t('discoverHub.title')}</Text>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('discoverHub.refreshA11y')}
          >
            <Ionicons name="refresh-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>{t('discoverHub.subtitle')}</Text>

        {loadErr ? <Text style={styles.errBanner}>{loadErr}</Text> : null}

        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="compass" size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>{t('discoverHub.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('discoverHub.heroSub')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('discoverHub.sectionExplore')}</Text>

        <DiscoverActionCard
          colors={colors}
          styles={styles}
          icon="map-outline"
          iconBg={colors.primary}
          borderColor={colors.primary}
          title={t('discoverHub.openMap')}
          description={t('discoverHub.openMapHint')}
          a11y={t('discoverHub.openMap')}
          onPress={() => navigation.navigate('MainTabs', { screen: 'VenuesTab' })}
        />

        <DiscoverActionCard
          colors={colors}
          styles={styles}
          icon="trophy-outline"
          iconBg={colors.xp}
          borderColor={colors.xp}
          title={t('discoverHub.challengesTitle')}
          description={t('discoverHub.challengesHint')}
          a11y={t('home.navChallenges')}
          onPress={() => navigation.navigate('Challenges')}
        />

        <DiscoverActionCard
          colors={colors}
          styles={styles}
          icon="bar-chart-outline"
          iconBg={colors.primaryDark}
          borderColor={colors.border}
          title={t('discoverHub.leaderboardTitle')}
          description={t('discoverHub.leaderboardHint')}
          a11y={t('home.navLeaderboard')}
          onPress={() => navigation.navigate('Leaderboard')}
        />

        <DiscoverActionCard
          colors={colors}
          styles={styles}
          icon="qr-code-outline"
          iconBg={colors.success}
          borderColor={colors.success}
          title={t('discoverHub.qrCheckIn')}
          description={t('discoverHub.qrCheckInHint')}
          a11y={t('discoverHub.qrCheckIn')}
          onPress={() => navigation.navigate('QrScan', {})}
        />

        <DiscoverActionCard
          colors={colors}
          styles={styles}
          icon="ticket-outline"
          iconBg={colors.primary}
          borderColor={colors.primary}
          title={t('discoverHub.redeemPerkTitle')}
          description={t('discoverHub.redeemPerkHint')}
          a11y={t('discoverHub.redeemPerkTitle')}
          onPress={() => navigation.navigate('RedeemPerk', {})}
        />

        {loading && !engagement && !summary ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : null}

        {(summary || engagement) && !loading ? (
          <>
            {summary?.subscriptionActive ? (
              <>
                <Text style={[styles.sectionLabel, styles.sectionSpacer]}>
                  {t('discoverHub.subscribersTitle')}
                </Text>
                {subscribers.length === 0 ? (
                  <Text style={styles.mutedLine}>{t('discoverHub.subscribersEmpty')}</Text>
                ) : (
                  subscribers.slice(0, 12).map((p) => (
                    <View key={p.id} style={styles.subscriberRow}>
                      <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.subscriberName}>{p.username}</Text>
                    </View>
                  ))
                )}
              </>
            ) : null}

            <Text style={[styles.sectionLabel, styles.sectionSpacer]}>
              {t('discoverHub.sectionProgress')}
            </Text>

            {summary ? (
              <View style={styles.statsCard}>
                <Text style={styles.statsCardTitle}>{t('discoverHub.progressTitle')}</Text>
                <Text style={styles.statsLine}>
                  {summary.nextTierXpThreshold != null
                    ? `${summary.xp} / ${summary.nextTierXpThreshold} XP · ${summary.tier}`
                    : `${summary.xp} XP · ${summary.tier}`}
                </Text>
                {xpProgress != null ? (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(xpProgress * 100)}%` }]} />
                  </View>
                ) : null}
                {summary.nextTierName ? (
                  <Text style={styles.statsMuted}>
                    {t('home.xpTowardNext', { nextTier: summary.nextTierName })}
                  </Text>
                ) : (
                  <Text style={styles.statsMuted}>{t('home.xpMaxTier')}</Text>
                )}
              </View>
            ) : null}

            {engagement ? (
              <View style={styles.statsCard}>
                <Text style={styles.statsCardTitle}>{t('discoverHub.crossVenueStats')}</Text>
                <Text style={styles.statsLine}>
                  {t('home.visitsThisWeek', { n: engagement.visitsThisWeek })}
                </Text>
                {engagement.distinctVenuesVisitedLast30Days > 0 ? (
                  <Text style={styles.statsMuted}>
                    {t('venueHub.venuesExploredMonth', {
                      n: engagement.distinctVenuesVisitedLast30Days,
                    })}
                  </Text>
                ) : null}
                {engagement.badges.length > 0 ? (
                  <View style={styles.badgeRow}>
                    {engagement.badges.map((b) => (
                      <View key={b} style={styles.badge}>
                        <Text style={styles.badgeText}>{badgeLabel(b)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
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
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    errBanner: {
      color: colors.error,
      fontSize: 14,
      marginBottom: spacing.md,
    },
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
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: spacing.md,
    },
    sectionSpacer: { marginTop: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
    },
    chevronCircle: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    loader: { marginVertical: spacing.xl },
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    statsCardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    statsLine: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    progressTrack: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.primaryMuted,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    progressFill: {
      height: '100%',
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    statsMuted: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    mutedLine: {
      color: colors.textMuted,
      fontSize: 14,
      marginBottom: spacing.md,
    },
    subscriberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      marginBottom: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    subscriberName: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    badge: {
      backgroundColor: colors.successMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
    },
    badgeText: {
      color: colors.success,
      fontSize: 11,
      fontWeight: '800',
    },
    pressed: { opacity: 0.88 },
  });
}
