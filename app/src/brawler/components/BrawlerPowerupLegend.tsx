import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  POWERUP_EFFECT_COLORS,
  POWERUP_EFFECT_LABELS,
} from '../arena/powerupMeta';
import type { BrawlerPowerupDef } from '../arena/types';
import type { AppColors } from '../../theme/colors';

const POWERUP_EFFECT_ICONS: Record<
  BrawlerPowerupDef['effectType'],
  React.ComponentProps<typeof Ionicons>['name']
> = {
  MOVE_SPEED_MULT: 'flash',
  ATTACK_DMG_MULT: 'flame',
  JUMP_MULT: 'arrow-up',
  DASH_SPEED_MULT: 'rocket',
  DASH_COOLDOWN_MULT: 'timer',
  HEAL_MAX_HP_PCT: 'medkit',
};

type Props = {
  colors: AppColors;
  title: string;
  powerups: BrawlerPowerupDef[];
};

export function BrawlerPowerupLegend({ colors, title, powerups }: Props) {
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  if (!powerups.length) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {powerups.map((p) => {
        const accent = POWERUP_EFFECT_COLORS[p.effectType];
        const icon = POWERUP_EFFECT_ICONS[p.effectType];
        const effectLabel = POWERUP_EFFECT_LABELS[p.effectType];
        return (
          <View key={p.id} style={styles.row}>
            <View style={[styles.iconWrap, { borderColor: accent }]}>
              <Ionicons name={icon} size={16} color={accent} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>{p.displayName}</Text>
              <Text style={styles.meta}>
                {effectLabel} · {p.description}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      marginTop: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 10,
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
    },
    copy: { flex: 1, gap: 2 },
    name: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
  });
}
