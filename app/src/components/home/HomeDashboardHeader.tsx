import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  displayName: string;
  avatarUrl?: string | null;
  xp: number | null;
  loadingXp: boolean;
  onSettings: () => void;
};

function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export default function HomeDashboardHeader({
  colors,
  displayName,
  avatarUrl,
  xp,
  loadingXp,
  onSettings,
}: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={styles.profile}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{avatarInitial(displayName)}</Text>
          </View>
        )}
        <View style={styles.greeting}>
          <Text style={styles.kicker}>{t('home.dashboard.welcomeBack')}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.xpPill} accessibilityLabel={t('home.dashboard.xpA11y', { xp: xp ?? 0 })}>
          <Ionicons name="trophy" size={16} color={colors.accentPink} />
          <Text style={styles.xpText}>{loadingXp ? '…' : `${xp ?? 0} XP`}</Text>
        </View>
        <Pressable
          onPress={onSettings}
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('home.navSettings')}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    profile: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minWidth: 0,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: colors.textInverse,
      fontSize: 20,
      fontWeight: '800',
    },
    greeting: { flex: 1, minWidth: 0 },
    kicker: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    name: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    xpPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.pill,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    xpText: {
      color: colors.xp,
      fontSize: 14,
      fontWeight: '800',
    },
    settingsBtn: {
      width: 44,
      height: 44,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.85 },
  });
}
