import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

export type MeQuickAction = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  onPress: () => void;
};

type Props = {
  colors: AppColors;
  actions: MeQuickAction[];
};

export default function MeQuickActions({ colors, actions }: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={[styles.iconWrap, { backgroundColor: action.tint }]}>
            <Ionicons name={action.icon} size={22} color={colors.textInverse} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    tile: {
      width: '47%',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      minHeight: 96,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    pressed: { opacity: 0.92 },
  });
}
