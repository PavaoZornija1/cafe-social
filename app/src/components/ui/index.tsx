import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type TextProps, type ViewProps } from 'react-native';

import { useAppTheme } from '../../theme/ThemeContext';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type CardProps = ViewProps & {
  children: React.ReactNode;
  padded?: boolean;
};

export function Card({ children, padded = true, style, ...rest }: CardProps) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.card, padded && styles.cardPadded, style]} {...rest}>
      {children}
    </View>
  );
}

type PrimaryButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  textStyle?: TextProps['style'];
  buttonStyle?: PressableProps['style'];
};

export function PrimaryButton({
  label,
  buttonStyle,
  textStyle,
  disabled,
  ...rest
}: PrimaryButtonProps) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => {
        const base = [
          styles.primaryButton,
          disabled && styles.primaryButtonDisabled,
          state.pressed && !disabled && styles.primaryButtonPressed,
        ];
        if (typeof buttonStyle === 'function') {
          return [...base, buttonStyle(state)];
        }
        return [...base, buttonStyle];
      }}
      {...rest}
    >
      <Text style={[styles.primaryButtonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardPadded: {
      padding: spacing.lg,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonPressed: { opacity: 0.88 },
    primaryButtonDisabled: { opacity: 0.45 },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
