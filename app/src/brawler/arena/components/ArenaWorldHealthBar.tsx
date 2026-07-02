import React from 'react';
import { StyleSheet, View } from 'react-native';

type Variant = 'hero' | 'enemy' | 'dummy';

type Props = {
  hp: number;
  maxHp: number;
  width: number;
  variant: Variant;
  iFrames?: boolean;
};

const FILL: Record<Variant, string> = {
  hero: '#4ade80',
  enemy: '#fb923c',
  dummy: '#f87171',
};

const GLOW: Record<Variant, string> = {
  hero: 'rgba(74, 222, 128, 0.45)',
  enemy: 'rgba(251, 146, 60, 0.4)',
  dummy: 'rgba(248, 113, 113, 0.4)',
};

export function ArenaWorldHealthBar({
  hp,
  maxHp,
  width,
  variant,
  iFrames = false,
}: Props) {
  const pct = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  const barH = variant === 'hero' ? 7 : 5;

  return (
    <View style={[styles.wrap, { width, height: barH }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(pct * 100)}%`,
            backgroundColor: FILL[variant],
            shadowColor: GLOW[variant],
            opacity: iFrames ? 0.72 : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
