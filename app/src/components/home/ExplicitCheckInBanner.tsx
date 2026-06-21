import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  onScan: () => void;
};

export default function ExplicitCheckInBanner({ colors, onScan }: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onScan}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('home.explicitCheckInCta')}
    >
      <Ionicons name="qr-code-outline" size={22} color={colors.warning} />
      <View style={styles.body}>
        <Text style={styles.title}>{t('home.explicitCheckInRequired')}</Text>
        <Text style={styles.cta}>{t('home.explicitCheckInCta')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.warning} />
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.warningBg,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warningBorder,
      padding: spacing.md,
    },
    body: { flex: 1, gap: spacing.xs },
    title: {
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    cta: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    pressed: { opacity: 0.9 },
  });
}
