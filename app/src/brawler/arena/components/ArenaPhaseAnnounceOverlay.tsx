import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { MatchPhaseKey } from '../combat';
import type { ArenaStyles } from '../styles';

const PHASE_ACCENT: Record<MatchPhaseKey, string> = {
  chaos: '#22d3ee',
  endgame: '#f97316',
  sudden_death: '#ef4444',
};

type Props = {
  styles: ArenaStyles;
  phaseKey: MatchPhaseKey;
  label: string;
  onDone: () => void;
};

export function ArenaPhaseAnnounceOverlay({ styles, phaseKey, label, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const slideY = useRef(new Animated.Value(18)).current;
  const accent = PHASE_ACCENT[phaseKey];

  useEffect(() => {
    opacity.setValue(0);
    scale.setValue(0.82);
    slideY.setValue(18);

    const enter = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.spring(slideY, {
        toValue: 0,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);

    const exit = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.06,
        duration: 420,
        useNativeDriver: true,
      }),
    ]);

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    enter.start(({ finished }) => {
      if (!finished || cancelled) return;
      holdTimer = setTimeout(() => {
        if (cancelled) return;
        exit.start(({ finished: exitFinished }) => {
          if (exitFinished && !cancelled) onDone();
        });
      }, 1800);
    });

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      opacity.stopAnimation();
      scale.stopAnimation();
      slideY.stopAnimation();
    };
  }, [label, onDone, opacity, phaseKey, scale, slideY]);

  return (
    <View style={styles.phaseAnnounceOverlay} pointerEvents="none">
      <Animated.Text
        style={[
          styles.phaseAnnounceTitle,
          {
            color: accent,
            opacity,
            transform: [{ scale }, { translateY: slideY }],
          },
        ]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}
