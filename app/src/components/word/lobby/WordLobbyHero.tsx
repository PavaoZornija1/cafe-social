import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LinearGradientFill from '../../ui/LinearGradientFill';

import type { AppColors } from '../../../theme/colors';
import { radii, spacing } from '../../../theme/tokens';

type Props = {
  colors: AppColors;
  title: string;
  subtitle: string;
  languageLabel: string;
};

export default function WordLobbyHero({ colors, title, subtitle, languageLabel }: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      <LinearGradientFill
        from={colors.heroDark}
        to={colors.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.badge}>
        <Ionicons name="extension-puzzle" size={12} color={colors.textInverse} />
        <Text style={styles.badgeText}>{title}</Text>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.langRow}>
        <Ionicons name="language-outline" size={14} color={colors.textInverse} />
        <Text style={styles.langText}>{languageLabel}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      overflow: 'hidden',
      backgroundColor: colors.heroDark,
      marginBottom: spacing.md,
    },
    gradient: {
      ...StyleSheet.absoluteFillObject,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    badgeText: {
      color: colors.textInverse,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    subtitle: {
      color: colors.textInverse,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.2,
      lineHeight: 24,
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    langText: {
      flex: 1,
      color: colors.textInverse,
      opacity: 0.9,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
  });
}
