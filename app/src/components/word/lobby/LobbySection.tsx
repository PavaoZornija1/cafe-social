import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import type { AppColors } from '../../../theme/colors';
import { radii, spacing } from '../../../theme/tokens';

type Props = ViewProps & {
  colors: AppColors;
  title: string;
  hint?: string;
  children: React.ReactNode;
};

export default function LobbySection({ colors, title, hint, children, style, ...rest }: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.section, style]} {...rest}>
      <Text style={styles.kicker}>{title}</Text>
      <View style={styles.body}>{children}</View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    section: {
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    kicker: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: -0.1,
    },
    body: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      paddingHorizontal: spacing.xs,
    },
  });
}
