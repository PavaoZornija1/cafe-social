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

import type { AppNavigationProps } from '../navigation/screenProps';
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          {!isTabRoot ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}
          <Pressable
            onPress={() => navigation.navigate('DailyWord')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.title}>{t('chooseGame.title')}</Text>
        <Text style={styles.subtitle}>{t('chooseGame.subtitle')}</Text>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t('chooseGame.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {hasVenueContext ? t('chooseGame.heroVenue') : t('chooseGame.heroGlobal')}
          </Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('WordLobby', { venueId, challengeId })}
          style={({ pressed }) => [styles.card, styles.wordCard, pressed && styles.pressed]}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="extension-puzzle" size={26} color={colors.textInverse} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{t('chooseGame.wordTitle')}</Text>
            <Text style={styles.cardDescription}>{t('chooseGame.wordDescription')}</Text>
            <Text style={styles.cardMeta}>
              {hasVenueContext ? t('chooseGame.wordCtaVenue') : t('chooseGame.wordCtaGlobal')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => venueId && navigation.navigate('BrawlerLobby', { venueId })}
          disabled={!hasVenueContext}
          style={({ pressed }) => [
            styles.card,
            styles.brawlerCard,
            !hasVenueContext && styles.cardDisabled,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.xp }]}>
            <Ionicons name="fitness" size={26} color={colors.textInverse} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{t('chooseGame.brawlerTitle')}</Text>
            <Text style={styles.cardDescription}>{t('chooseGame.brawlerDescription')}</Text>
            <Text style={styles.cardMeta}>
              {hasVenueContext ? t('chooseGame.brawlerCta') : t('chooseGame.brawlerNeedVenue')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
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
      paddingBottom: spacing.xxl,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.md,
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
    },
    iconBtnPlaceholder: { width: 44 },
    title: {
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    wordCard: { borderColor: colors.primary },
    brawlerCard: { borderColor: colors.xp },
    cardDisabled: { opacity: 0.5 },
    cardIcon: {
      width: 52,
      height: 52,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1, gap: 4 },
    cardTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    cardDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    cardMeta: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
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
