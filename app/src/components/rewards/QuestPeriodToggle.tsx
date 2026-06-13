import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { QuestPeriod } from '../../lib/platformQuestApi';
import type { AppColors } from '../../theme/colors';
import { radii, spacing } from '../../theme/tokens';

type Props = {
  colors: AppColors;
  period: QuestPeriod;
  dailyLabel: string;
  weeklyLabel: string;
  onChange: (period: QuestPeriod) => void;
};

export default function QuestPeriodToggle({
  colors,
  period,
  dailyLabel,
  weeklyLabel,
  onChange,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange('daily')}
        style={[styles.pill, period === 'daily' && styles.pillActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: period === 'daily' }}
      >
        <Text style={[styles.pillText, period === 'daily' && styles.pillTextActive]}>
          {dailyLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('weekly')}
        style={[styles.pill, period === 'weekly' && styles.pillActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: period === 'weekly' }}
      >
        <Text style={[styles.pillText, period === 'weekly' && styles.pillTextActive]}>
          {weeklyLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: colors.bgElevated,
      borderRadius: radii.pill,
      padding: 4,
      gap: 4,
    },
    pill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    pillActive: {
      backgroundColor: colors.primary,
    },
    pillText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
    pillTextActive: {
      color: colors.textInverse,
    },
  });
}
