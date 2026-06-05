import React from 'react';
import { Text, View } from 'react-native';
import type { HeroStatRow } from '../heroStatHighlights';
import type { ArenaStyles } from '../styles';

type Props = {
  styles: ArenaStyles;
  rows: HeroStatRow[];
};

export function ArenaHeroStatsHud({ styles, rows }: Props) {
  return (
    <View style={styles.heroStatsHud} pointerEvents="none">
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
