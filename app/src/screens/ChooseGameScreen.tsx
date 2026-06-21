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
import type { AppNavigationProps } from '../navigation/screenProps';
import { usePlayVenueAccess } from '../hooks/usePlayVenueAccess';
import { needsExplicitCheckInBanner } from '../lib/explicitCheckIn';
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
  const venueId = params?.venueId;
  const challengeId = params?.challengeId;
  const hasVenueContext = Boolean(venueId);
  const { access, resolvedVenueId } = usePlayVenueAccess(venueId);
  const showCheckIn = needsExplicitCheckInBanner(access);

  const openQrCheckIn = () => {
    const id = resolvedVenueId ?? venueId;
    if (id) navigation.navigate('QrScan', { venueId: id });
  };

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

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('chooseGame.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {hasVenueContext ? t('chooseGame.heroVenue') : t('chooseGame.heroGlobal')}
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('WordLobby', { venueId, challengeId })}
          disabled={showCheckIn}
          style={({ pressed }) => [
            styles.card,
            styles.wordCard,
            showCheckIn && styles.cardDisabled,
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
            {hasVenueContext ? t('chooseGame.wordCtaVenue') : t('chooseGame.wordCtaGlobal')}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => venueId && navigation.navigate('BrawlerLobby', { venueId })}
          disabled={!hasVenueContext || showCheckIn}
          style={({ pressed }) => [
            styles.card,
            styles.brawlerCard,
            (!hasVenueContext || showCheckIn) && styles.cardDisabled,
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
            {hasVenueContext ? t('chooseGame.brawlerCta') : t('chooseGame.brawlerNeedVenue')}
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
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    checkInWrap: { marginBottom: spacing.md },
    hero: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    heroTitle: {
      color: colors.textInverse,
      fontSize: 22,
      fontWeight: '900',
    },
    heroSub: {
      color: colors.textInverse,
      opacity: 0.9,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    wordCard: { borderColor: colors.primary },
    brawlerCard: { borderColor: colors.xp },
    cardDisabled: { opacity: 0.5 },
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
      fontSize: 18,
      fontWeight: '800',
    },
    cardDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    cardMeta: { color: colors.primary, fontSize: 12, fontWeight: '700' },
    brawlerMeta: { color: colors.xp },
    dailyNote: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    pressed: { opacity: 0.92 },
  });
}
