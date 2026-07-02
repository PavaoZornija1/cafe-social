import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  streak: number;
  solved: boolean;
  attempts: number;
  maxAttempts: number;
  onPress: () => void;
};

export default function HomeVenueDailyWordChip({
  colors,
  streak,
  solved,
  attempts,
  maxAttempts,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const subtitle = solved
    ? t('home.venueDailyWordSolved', { streak })
    : t('home.venueDailyWordOpen', { streak, attempts, max: maxAttempts });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('home.venueDailyWordA11y')}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="calendar" size={20} color={colors.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t('home.venueDailyWordTitle')}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {streak > 0 ? (
        <View style={styles.streakBadge}>
          <Text style={styles.streakText}>{t('home.venueDailyWordStreakBadge', { n: streak })}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary,
      padding: spacing.md,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
    streakBadge: {
      backgroundColor: colors.honeyMuted,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    streakText: {
      color: colors.xp,
      fontSize: 12,
      fontWeight: '800',
    },
    pressed: { opacity: 0.92 },
  });
}
