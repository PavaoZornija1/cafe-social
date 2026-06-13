import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

export type VenuesFilterKey = 'nearMe' | 'hasOffer' | 'friends';

type Props = {
  colors: AppColors;
  active: Record<VenuesFilterKey, boolean>;
  onToggle: (key: VenuesFilterKey) => void;
};

type ChipDef = {
  key: VenuesFilterKey;
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const CHIPS: ChipDef[] = [
  { key: 'nearMe', labelKey: 'partnerMap.chipNearMe', icon: 'navigate-outline' },
  { key: 'hasOffer', labelKey: 'partnerMap.chipHasOffer', icon: 'gift-outline' },
  { key: 'friends', labelKey: 'partnerMap.chipFriends', icon: 'people-outline' },
];

export default function VenuesFilterChips({ colors, active, onToggle }: Props) {
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {CHIPS.map((chip) => {
        const selected = active[chip.key];
        return (
          <Pressable
            key={chip.key}
            onPress={() => onToggle(chip.key)}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Ionicons
              name={chip.icon}
              size={16}
              color={selected ? colors.textInverse : colors.textSecondary}
            />
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {t(chip.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    chipTextSelected: {
      color: colors.textInverse,
    },
    pressed: { opacity: 0.9 },
  });
}
