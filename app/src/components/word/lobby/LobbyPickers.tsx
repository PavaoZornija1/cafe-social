import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppColors } from '../../../theme/colors';
import { radii, spacing } from '../../../theme/tokens';

export type LobbySegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  colors: AppColors;
  options: LobbySegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function LobbySegmentedControl<T extends string>({
  colors,
  options,
  value,
  onChange,
}: Props<T>) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ModeCardOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ModePickerProps<T extends string> = {
  colors: AppColors;
  options: ModeCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function LobbyModePicker<T extends string>({
  colors,
  options,
  value,
  onChange,
}: ModePickerProps<T>) {
  const styles = useMemo(() => createModeStyles(colors), [colors]);

  return (
    <View style={styles.list}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.card,
              active && styles.cardActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons
                name={option.icon}
                size={20}
                color={active ? colors.textInverse : colors.primary}
              />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, active && styles.titleActive]}>{option.label}</Text>
              <Text style={[styles.description, active && styles.descriptionActive]}>
                {option.description}
              </Text>
            </View>
            {active ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            ) : (
              <View style={styles.radioEmpty} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type ChipProps<T> = {
  colors: AppColors;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function LobbyChipPicker<T extends string | number>({
  colors,
  options,
  value,
  onChange,
}: ChipProps<T>) {
  const styles = useMemo(() => createChipStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    label: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 13,
      textAlign: 'center',
    },
    labelActive: {
      color: colors.primaryDark,
    },
    pressed: { opacity: 0.9 },
  });
}

function createModeStyles(colors: AppColors) {
  return StyleSheet.create({
    list: { gap: spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cardActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconWrapActive: {
      backgroundColor: colors.primary,
    },
    copy: { flex: 1, gap: 2 },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    titleActive: {
      color: colors.primaryDark,
    },
    description: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
    },
    descriptionActive: {
      color: colors.textSecondary,
    },
    radioEmpty: {
      width: 22,
      height: 22,
      borderRadius: radii.pill,
      borderWidth: 2,
      borderColor: colors.borderStrong,
    },
    pressed: { opacity: 0.92 },
  });
}

function createChipStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontWeight: '800',
      fontSize: 13,
    },
    chipTextActive: {
      color: colors.primaryDark,
    },
    pressed: { opacity: 0.9 },
  });
}
