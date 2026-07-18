import { useAuth, useUser } from '@clerk/expo';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';

import MeProfileHeader from '../components/me/MeProfileHeader';
import MeQuickActions, { type MeQuickAction } from '../components/me/MeQuickActions';
import { Card } from '../components/ui';
import type { AppNavigationProps } from '../navigation/screenProps';
import { useIsTabRoot } from '../navigation/useIsTabRoot';
import { apiGet } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { createAndShareFriendInviteLink } from '../lib/friendInviteShare';
import { useMeSummaryQuery } from '../query';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';
import { radii, spacing } from '../theme/tokens';

type Props = AppNavigationProps;

type PerkRedemptionItem = {
  id: string;
  redeemedAt: string;
  voided: boolean;
  venueId: string;
  venueName: string;
  perkCode: string;
  perkTitle: string;
  perkSubtitle: string | null;
  perkActiveTo: string | null;
  daysUntilExpiry: number | null;
  expiringSoon: boolean;
  expired: boolean;
};

type PerkRedemptionsPayload = {
  wallet: { activeRedemptions: number };
  expiringSoon: PerkRedemptionItem[];
  items: PerkRedemptionItem[];
};

export default function ProfileScreen({ navigation }: Props) {
  const isTabRoot = useIsTabRoot('MeTab');
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const { user } = useUser();
  const { isLoaded, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const meQuery = useMeSummaryQuery();
  const summary = meQuery.data ?? null;
  const [perkInitializing, setPerkInitializing] = useState(true);
  const [perkPayload, setPerkPayload] = useState<PerkRedemptionsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const hasLoadedPerksRef = useRef(false);
  const showInitialSpinner =
    (meQuery.isLoading && !meQuery.data) || (perkInitializing && !hasLoadedPerksRef.current);

  const displayName =
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    t('home.guestName');

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!isLoaded) return;
    if (mode === 'initial' && !hasLoadedPerksRef.current) {
      setPerkInitializing(true);
    }
    setError(null);
    try {
      const token = await getTokenRef.current();
      if (!token) {
        setPerkPayload(null);
        return;
      }
      await meQuery.refetch();
      const raw = await apiGet<PerkRedemptionsPayload>(
        '/players/me/perk-redemptions',
        token,
      );
      if (raw && Array.isArray(raw.items)) {
        setPerkPayload(raw);
      } else {
        setPerkPayload({ wallet: { activeRedemptions: 0 }, expiringSoon: [], items: [] });
      }
    } catch {
      setError(t('profile.loadError'));
      setPerkPayload(null);
    } finally {
      hasLoadedPerksRef.current = true;
      setPerkInitializing(false);
    }
  }, [isLoaded, meQuery, t]);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedPerksRef.current ? 'refresh' : 'initial');
    }, [load]),
  );

  const shareFriendLink = async () => {
    setSharing(true);
    try {
      const token = await getTokenRef.current();
      await createAndShareFriendInviteLink(token, t);
    } catch (e) {
      Alert.alert(t('common.error'), (e as Error).message ?? t('friends.friendLinkFailed'));
    } finally {
      setSharing(false);
    }
  };

  const quickActions = useMemo((): MeQuickAction[] => {
    return [
      {
        key: 'discover',
        label: t('home.navDiscoverHub'),
        icon: 'compass',
        tint: colors.primaryDark,
        onPress: () => navigation.navigate('DiscoverHub'),
      },
      {
        key: 'redeem',
        label: t('home.linkRedeemPerk'),
        icon: 'ticket',
        tint: colors.success,
        onPress: () => navigation.navigate('RedeemPerk', {}),
      },
      {
        key: 'quests',
        label: t('profile.openQuestHub'),
        icon: 'gift',
        tint: colors.primary,
        onPress: () => navigation.navigate('RewardsHub'),
      },
      {
        key: 'perks',
        label: t('profile.openPerkWallet'),
        icon: 'qr-code',
        tint: colors.xp,
        onPress: () => navigation.navigate('PerkWallet'),
      },
      {
        key: 'member',
        label: t('profile.openMemberCard'),
        icon: 'card',
        tint: '#16A34A',
        onPress: () => navigation.navigate('MemberCard'),
      },
      {
        key: 'invite',
        label: sharing ? '…' : t('profile.shareFriendLink'),
        icon: 'share-social',
        tint: colors.accentPink,
        onPress: () => void shareFriendLink(),
      },
    ];
  }, [colors, navigation, sharing, t]);

  const wallet = perkPayload?.wallet;
  const expiringSoon = perkPayload?.expiringSoon ?? [];
  const redemptionItems = perkPayload?.items ?? [];

  const statRows = summary
    ? [
        { label: t('profile.ratingGlobal'), value: summary.competitiveRankRating ?? '—' },
        { label: t('profile.ratingWord'), value: summary.wordRankRating ?? '—' },
        { label: t('profile.ratingBrawler'), value: summary.brawlerRankRating ?? '—' },
        { label: t('profile.completedChallenges'), value: summary.completedChallenges },
        { label: t('profile.venuesUnlocked'), value: summary.venuesUnlocked },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      {!isTabRoot ? (
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showInitialSpinner && !summary ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {summary ? (
          <MeProfileHeader
            colors={colors}
            displayName={displayName}
            avatarUrl={user?.imageUrl}
            tier={summary.tier}
            xp={summary.xp}
            nextTierName={summary.nextTierName}
            nextTierXp={summary.nextTierXpThreshold}
            onSettings={() => navigation.navigate('Settings')}
          />
        ) : null}

        <MeQuickActions colors={colors} actions={quickActions} />

        {wallet ? (
          <Pressable
            onPress={() => navigation.navigate('PerkWallet')}
            style={({ pressed }) => [styles.walletCard, pressed && styles.pressed]}
          >
            <View>
              <Text style={styles.walletTitle}>{t('profile.walletTitle')}</Text>
              <Text style={styles.walletStat}>
                {t('profile.walletActive', { count: wallet.activeRedemptions })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {statRows.length > 0 ? (
          <Card style={styles.statsCard}>
            <Text style={styles.sectionTitle}>{t('profile.statsTitle')}</Text>
            {statRows.map((row) => (
              <View key={row.label} style={styles.statRow}>
                <Text style={styles.statLabel}>{row.label}</Text>
                <Text style={styles.statValue}>{String(row.value)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {expiringSoon.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('profile.expiringSoonTitle')}</Text>
            <Text style={styles.sectionHint}>{t('profile.expiringSoonHint')}</Text>
            {expiringSoon.slice(0, 3).map((row) => (
              <Card key={row.id} style={styles.perkItem}>
                <Text style={styles.perkTitle}>{row.perkTitle}</Text>
                <Text style={styles.perkVenue}>{row.venueName}</Text>
              </Card>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t('profile.recentPerksTitle')}</Text>
        {!showInitialSpinner && redemptionItems.length === 0 ? (
          <Text style={styles.muted}>{t('profile.recentPerksEmpty')}</Text>
        ) : (
          redemptionItems.slice(0, 5).map((row) => (
            <Card key={row.id} style={styles.perkItem}>
              <Text style={styles.perkTitle}>{row.perkTitle}</Text>
              {row.venueName ? (
                <Text style={styles.perkVenue}>{row.venueName}</Text>
              ) : null}
            </Card>
          ))
        )}

        {redemptionItems.length > 5 ? (
          <Pressable onPress={() => navigation.navigate('PerkWallet')} style={styles.seeAll}>
            <Text style={styles.seeAllText}>{t('profile.seeAllPerks')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    back: {
      marginLeft: spacing.xl,
      marginTop: spacing.sm,
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    loader: { marginVertical: spacing.xxl },
    error: { color: colors.error, fontSize: 14 },
    walletCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryMuted,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      padding: spacing.lg,
    },
    walletTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    walletStat: {
      color: colors.primaryDark,
      fontSize: 14,
      fontWeight: '600',
      marginTop: 4,
    },
    statsCard: { gap: spacing.sm },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    statLabel: { color: colors.textSecondary, fontSize: 14 },
    statValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      marginTop: spacing.sm,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    perkItem: { marginBottom: spacing.sm },
    perkTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
    perkVenue: { color: colors.primary, marginTop: 4, fontSize: 13, fontWeight: '600' },
    muted: { color: colors.textMuted, fontSize: 14 },
    seeAll: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
    seeAllText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    pressed: { opacity: 0.92 },
  });
}
