import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { ArenaAnnounce, ArenaAnnounceKind } from '../arenaAnnounces';
import type { ArenaStyles } from '../styles';

const ANNOUNCE_ACCENT: Record<ArenaAnnounceKind, string> = {
  phase_chaos: '#22d3ee',
  phase_endgame: '#f97316',
  phase_sudden_death: '#ef4444',
  death_duel: '#f43f5e',
};

const HOLD_MS = 2200;
const ENTER_MS = 420;
const EXIT_MS = 480;

type Props = {
  styles: ArenaStyles;
  announce: ArenaAnnounce;
  onDone: () => void;
};

export function ArenaPhaseAnnounceOverlay({ styles, announce, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.55)).current;
  const slideY = useRef(new Animated.Value(28)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const accent = ANNOUNCE_ACCENT[announce.kind];
  const dramatic =
    announce.kind === 'phase_sudden_death' || announce.kind === 'death_duel';

  useEffect(() => {
    opacity.setValue(0);
    scale.setValue(0.55);
    slideY.setValue(28);
    wobble.setValue(0);

    const enter = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: dramatic ? 5 : 7,
        tension: dramatic ? 120 : 90,
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
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: dramatic ? 1.12 : 1.06,
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
    ]);

    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let wobbleAnim: Animated.CompositeAnimation | null = null;
    let cancelled = false;

    if (dramatic) {
      wobbleAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(wobble, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.timing(wobble, {
            toValue: -1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(wobble, {
            toValue: 0,
            duration: 90,
            useNativeDriver: true,
          }),
        ]),
      );
      wobbleAnim.start();
    }

    enter.start(({ finished }) => {
      if (!finished || cancelled) return;
      holdTimer = setTimeout(() => {
        if (cancelled) return;
        wobbleAnim?.stop();
        exit.start(({ finished: exitFinished }) => {
          if (exitFinished && !cancelled) onDone();
        });
      }, HOLD_MS);
    });

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      wobbleAnim?.stop();
      opacity.stopAnimation();
      scale.stopAnimation();
      slideY.stopAnimation();
      wobble.stopAnimation();
    };
  }, [announce.kind, announce.subtitle, announce.title, dramatic, onDone, opacity, scale, slideY, wobble]);

  const rotate = wobble.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-3deg', '0deg', '3deg'],
  });

  return (
    <View style={styles.phaseAnnounceOverlay} pointerEvents="none">
      <Animated.View
        style={{
          opacity,
          transform: [{ scale }, { translateY: slideY }, { rotate }],
          alignItems: 'center',
          paddingHorizontal: 20,
        }}
      >
        <Animated.Text
          style={[
            styles.phaseAnnounceTitle,
            {
              color: accent,
              textShadowColor: accent,
              textShadowRadius: dramatic ? 14 : 8,
            },
          ]}
        >
          {announce.title}
        </Animated.Text>
        {announce.subtitle ? (
          <Animated.Text
            style={[styles.phaseAnnounceSubtitle, { color: accent }]}
          >
            {announce.subtitle}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
