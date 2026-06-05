import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { BrawlerPowerupDef } from '../types';

const EFFECT_COLORS: Record<BrawlerPowerupDef['effectType'], string> = {
  MOVE_SPEED_MULT: '#22d3ee',
  ATTACK_DMG_MULT: '#f97316',
  JUMP_MULT: '#22c55e',
  DASH_SPEED_MULT: '#eab308',
  DASH_COOLDOWN_MULT: '#a78bfa',
};

const EFFECT_ICONS: Record<
  BrawlerPowerupDef['effectType'],
  React.ComponentProps<typeof Ionicons>['name']
> = {
  MOVE_SPEED_MULT: 'flash',
  ATTACK_DMG_MULT: 'flame',
  JUMP_MULT: 'arrow-up',
  DASH_SPEED_MULT: 'rocket',
  DASH_COOLDOWN_MULT: 'timer',
};

type Props = {
  effectType: BrawlerPowerupDef['effectType'];
  size: number;
};

export function PowerupPickupIcon({ effectType, size }: Props) {
  const accent = EFFECT_COLORS[effectType];
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale }],
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent,
          opacity: glowOpacity,
        }}
      />
      <View
        style={{
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: (size * 0.82) / 2,
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          borderWidth: 2,
          borderColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Ionicons name={EFFECT_ICONS[effectType]} size={size * 0.42} color={accent} />
      </View>
    </Animated.View>
  );
}

export function powerupEffectTypeFromId(
  powerupId: string,
  defs: BrawlerPowerupDef[],
): BrawlerPowerupDef['effectType'] {
  return defs.find((d) => d.id === powerupId)?.effectType ?? 'MOVE_SPEED_MULT';
}
