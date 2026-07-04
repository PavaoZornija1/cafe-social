import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import ExplicitCheckInBanner from '../components/home/ExplicitCheckInBanner';
import VenuePlayTimeBar from '../components/VenuePlayTimeBar';
import type { AppNavigationProps } from '../navigation/screenProps';
import {
  useAuthToken,
  useVenueOffersQuery,
  useVenueSession,
} from '../query';
import { useIsTabRoot } from '../navigation/useIsTabRoot';
import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

type Props = AppNavigationProps;

export default function ChooseGameScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const isTabRoot = useIsTabRoot('PlayTab');
  const params = route.params as { venueId?: string; challengeId?: string } | undefined;
  const routeVenueId = params?.venueId;
  const challengeId = params?.challengeId;

  const session = useVenueSession({ routeVenueId });
  const {
    playVenueId,
    showCheckIn,
    venueLocked,
    venueLockKey,
    canEnterVenueContext,
    subscriptionActive,
    canDoVenueActions,
    isLoading: accessLoading,
  } = session;

  const { getToken } = useAuthToken();

  const offersQuery = useVenueOffersQuery(playVenueId);
  const activeXpMultiplier = useMemo(() => {
    const offers = offersQuery.data ?? [];
    return Math.max(
      1,
      ...offers
        .filter((o) => o.fulfillment === 'AUTO' && (o.autoXpMultiplier ?? 0) > 1)
        .map((o) => o.autoXpMultiplier ?? 1),
    );
  }, [offersQuery.data]);

  const openQrCheckIn = () => {
    if (playVenueId) navigation.navigate('QrScan', { venueId: playVenueId });
  };

  const openWordLobby = () => {
    if (!canDoVenueActions) return;
    navigation.navigate('WordLobby', {
      ...(playVenueId ? { venueId: playVenueId } : {}),
      ...(challengeId ? { challengeId } : {}),
    });
  };

  const openBrawlerLobby = () => {
    if (!canDoVenueActions) return;
    navigation.navigate('BrawlerLobby', playVenueId ? { venueId: playVenueId } : {});
  };

  const playBlocked = accessLoading || !canDoVenueActions;
  const wordBlocked = playBlocked;
  const brawlerBlocked = playBlocked;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          {!isTabRoot ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Text style={styles.title}>{t('chooseGame.title')}</Text>
          <Pressable
            onPress={() => navigation.navigate('DailyWord')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('dailyWord.title')}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>{t('chooseGame.subtitle')}</Text>

        {showCheckIn ? (
          <View style={styles.checkInWrap}>
            <ExplicitCheckInBanner colors={colors} onScan={openQrCheckIn} />
          </View>
        ) : null}

        {venueLocked && venueLockKey ? (
          <View style={styles.lockBanner}>
            <Ionicons name="lock-closed" size={18} color={colors.error} />
            <Text style={styles.lockBannerText}>{t(venueLockKey)}</Text>
          </View>
        ) : null}

        {!canDoVenueActions && !accessLoading && !venueLocked ? (
          <View style={styles.lockBanner}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.lockBannerText, { color: colors.textSecondary }]}>
              {t('home.playLockedHint')}
            </Text>
          </View>
        ) : null}

        {canDoVenueActions && activeXpMultiplier > 1 ? (
          <View style={styles.xpBoostBanner}>
            <Ionicons name="flash" size={18} color={colors.xp} />
            <Text style={styles.xpBoostText}>
              {t('chooseGame.xpBoostActive', { mult: activeXpMultiplier })}
            </Text>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('chooseGame.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {venueLocked
              ? t('chooseGame.heroLocked')
              : playVenueId
                ? t('chooseGame.heroVenue')
                : t('chooseGame.heroGlobal')}
          </Text>
        </View>

        {playVenueId && canDoVenueActions ? (
          <VenuePlayTimeBar
            venueId={playVenueId}
            getToken={async () => (await getToken()) ?? null}
            subscriptionActive={subscriptionActive}
            variant="compact"
          />
        ) : null}

        <Pressable
          onPress={openWordLobby}
          disabled={wordBlocked}
          style={({ pressed }) => [
            styles.card,
            styles.wordCard,
            wordBlocked && styles.cardDisabled,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="extension-puzzle" size={26} color={colors.textInverse} />
            </View>
            <Text style={styles.cardTitle}>{t('chooseGame.wordTitle')}</Text>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </View>
          <Text style={styles.cardDescription}>{t('chooseGame.wordDescription')}</Text>
          <Text style={styles.cardMeta}>
            {accessLoading
              ? t('common.loading')
              : canEnterVenueContext
                ? t('chooseGame.wordCtaVenue')
                : subscriptionActive
                  ? t('chooseGame.wordCtaGlobal')
                  : t('chooseGame.wordNeedVenue')}
          </Text>
        </Pressable>

        <Pressable
          onPress={openBrawlerLobby}
          disabled={brawlerBlocked}
          style={({ pressed }) => [
            styles.card,
            styles.brawlerCard,
            brawlerBlocked ? styles.cardDisabled : null,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIcon, { backgroundColor: colors.xp }]}>
              <Ionicons name="fitness" size={26} color={colors.textInverse} />
            </View>
            <Text style={styles.cardTitle}>{t('chooseGame.brawlerTitle')}</Text>
            <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
          </View>
          <Text style={styles.cardDescription}>{t('chooseGame.brawlerDescription')}</Text>
          <Text style={[styles.cardMeta, styles.brawlerMeta]}>
            {accessLoading
              ? t('common.loading')
              : playVenueId
                ? t('chooseGame.brawlerCta')
                : subscriptionActive
                  ? t('chooseGame.brawlerCtaGlobal')
                  : t('chooseGame.brawlerNeedVenue')}
          </Text>
        </Pressable>

        <Text style={styles.dailyNote}>{t('chooseGame.dailyWordNote')}</Text>
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
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    checkInWrap: { marginBottom: spacing.md },
    lockBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.errorMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.error,
    },
    lockBannerText: {
      flex: 1,
      color: colors.error,
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 20,
    },
    xpBoostBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.honeyMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.honey,
    },
    xpBoostText: { flex: 1, color: colors.honeyDark, fontWeight: '800', fontSize: 14 },
    hero: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    heroTitle: { color: colors.textInverse, fontSize: 20, fontWeight: '900' },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.92,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    wordCard: {},
    brawlerCard: {},
    cardDisabled: { opacity: 0.55 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '900' },
    cardDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
      marginTop: spacing.md,
    },
    cardMeta: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
      marginTop: spacing.sm,
    },
    brawlerMeta: { color: colors.xp },
    dailyNote: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
      marginTop: spacing.sm,
    },
    pressed: { opacity: 0.9 },
  });
}
