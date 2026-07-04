import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import LinearGradientFill from '../ui/LinearGradientFill';
import type { AppColors } from '../../theme/colors';
import type { PostGameMomentIcon } from '../../lib/postGame/types';

const SPARKLE_OFFSETS = [
  { top: '8%', left: '18%', size: 12 },
  { top: '14%', right: '16%', size: 10 },
  { bottom: '18%', left: '22%', size: 11 },
  { bottom: '12%', right: '20%', size: 13 },
] as const;

const ICON_MAP: Record<PostGameMomentIcon, React.ComponentProps<typeof Ionicons>['name']> = {
  trophy: 'trophy',
  flash: 'flash',
  cafe: 'cafe',
  star: 'star',
  'game-controller': 'game-controller',
  sparkles: 'sparkles',
};

type Props = {
  colors: AppColors;
  icon: PostGameMomentIcon;
  won?: boolean;
  compact?: boolean;
};

export default function SunburstHero({ colors, icon, won, compact = false }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const heroScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const iconName = won === false ? 'flag-outline' : ICON_MAP[icon];
  const iconSize = compact ? 28 : 56;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity }]}>
        <LinearGradientFill
          from="#FFF4D6"
          to="#FFE08A"
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.ray,
            { transform: [{ rotate: `${i * 36}deg` }] },
          ]}
        />
      ))}
      {SPARKLE_OFFSETS.map((s, idx) => (
        <Ionicons
          key={idx}
          name="sparkles"
          size={compact ? Math.max(8, s.size - 3) : s.size}
          color={colors.honey}
          style={[
            styles.sparkle,
            'top' in s ? { top: s.top } : null,
            'left' in s ? { left: s.left } : null,
            'right' in s ? { right: s.right } : null,
            'bottom' in s ? { bottom: s.bottom } : null,
          ]}
        />
      ))}
      <Animated.View style={[styles.iconCircle, { transform: [{ scale: heroScale }] }]}>
        <Ionicons name={iconName} size={iconSize} color={colors.xp} />
      </Animated.View>
    </View>
  );
}

function createStyles(colors: AppColors, compact = false) {
  const wrap = compact ? 96 : 220;
  const glow = compact ? 68 : 170;
  const rayH = compact ? 42 : 92;
  const iconCircle = compact ? 52 : 96;
  return StyleSheet.create({
    wrap: {
      width: wrap,
      height: wrap,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      position: 'absolute',
      width: glow,
      height: glow,
      borderRadius: 999,
      overflow: 'hidden',
    },
    ray: {
      position: 'absolute',
      width: compact ? 6 : 8,
      height: rayH,
      borderRadius: 999,
      backgroundColor: '#FFF0BF',
      top: compact ? 8 : 18,
    },
    sparkle: {
      position: 'absolute',
      opacity: 0.9,
    },
    iconCircle: {
      width: iconCircle,
      height: iconCircle,
      borderRadius: 999,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.honeyDark,
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  });
}
