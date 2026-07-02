import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  displayName: string;
  avatarUrl?: string | null;
  tier: string;
  xp: number;
  nextTierName?: string | null;
  nextTierXp?: number | null;
  onSettings: () => void;
};

function initial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export default function MeProfileHeader({
  colors,
  displayName,
  avatarUrl,
  tier,
  xp,
  nextTierName,
  nextTierXp,
  onSettings,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress =
    nextTierXp != null && nextTierXp > 0 ? Math.min(1, xp / nextTierXp) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.profileRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial(displayName)}</Text>
          </View>
        )}
        <View style={styles.greeting}>
          <Text style={styles.kicker}>Me</Text>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.tierPill}>
            <Ionicons name="ribbon" size={14} color={colors.xp} />
            <Text style={styles.tierText}>{tier}</Text>
          </View>
        </View>
        <Pressable
          onPress={onSettings}
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.xpCard}>
        <View>
          <Text style={styles.xpLabel}>Lifetime XP</Text>
          <Text style={styles.xpValue}>{xp}</Text>
          {nextTierName && nextTierXp ? (
            <Text style={styles.xpSub}>
              {nextTierXp - xp > 0 ? `${nextTierXp - xp} XP to ${nextTierName}` : nextTierName}
            </Text>
          ) : null}
        </View>
        <View style={styles.xpIcon}>
          <Ionicons name="trophy" size={28} color={colors.textInverse} />
        </View>
        {progress != null ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: { gap: spacing.lg },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
    },
    avatarFallback: {
      width: 56,
      height: 56,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: colors.textInverse,
      fontSize: 24,
      fontWeight: '800',
    },
    greeting: { flex: 1, minWidth: 0, gap: 2 },
    kicker: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    name: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    tierPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginTop: 4,
      backgroundColor: colors.honeyMuted,
      borderRadius: radii.sm,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    tierText: {
      color: colors.xp,
      fontSize: 12,
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
    xpCard: {
      backgroundColor: colors.hero,
      borderRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.md,
    },
    xpLabel: {
      color: colors.textInverse,
      opacity: 0.85,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    xpValue: {
      color: colors.textInverse,
      fontSize: 36,
      fontWeight: '900',
      marginTop: 2,
    },
    xpSub: {
      color: colors.textInverse,
      opacity: 0.9,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    xpIcon: {
      position: 'absolute',
      top: spacing.xl,
      right: spacing.xl,
      width: 48,
      height: 48,
      borderRadius: radii.lg,
      backgroundColor: colors.heroDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: {
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.textInverse,
      borderRadius: radii.pill,
    },
    pressed: { opacity: 0.9 },
  });
}
