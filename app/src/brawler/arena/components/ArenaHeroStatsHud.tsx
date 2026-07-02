import React from 'react';
import { Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { HeroStatRow } from '../heroStatHighlights';
import type { ArenaStyles } from '../styles';

type Props = {
  styles: ArenaStyles;
  rows: HeroStatRow[];
  insetStyle?: StyleProp<ViewStyle>;
};

export function ArenaHeroStatsHud({ styles, rows, insetStyle }: Props) {
  return (
    <View style={[styles.heroStatsHud, insetStyle]} pointerEvents="none">
      <Text style={styles.heroStatsHudTitle}>Stats</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.heroStatsHudItem}>
          <Text
            style={[
              styles.heroStatsHudLabel,
              row.boosted && styles.heroStatsHudBoosted,
            ]}
          >
            {row.label}
          </Text>
          <Text
            style={[
              styles.heroStatsHudValue,
              row.boosted && styles.heroStatsHudBoosted,
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
