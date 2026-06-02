import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { ArenaStyles } from '../styles';

type Props = {
  kind: 'hit' | 'dash' | 'jump';
  enabled: boolean;
  label: string;
  subLabel?: string;
  left: number;
  top: number;
  joystickGesture: unknown | null;
  onTap: () => void;
  styles: ArenaStyles;
};

export function ActionTapButton({
  kind,
  enabled,
  label,
  subLabel,
  left,
  top,
  joystickGesture,
  onTap,
  styles,
}: Props) {
  const [pressed, setPressed] = useState(false);

  const tap = useMemo(() => {
    let g = Gesture.Tap()
      .enabled(enabled)
      .runOnJS(true)
      .maxDuration(600)
      .onBegin(() => setPressed(true))
      .onFinalize(() => setPressed(false))
      .onEnd((_e, success) => {
        if (success && enabled) onTap();
      });
    if (joystickGesture) {
      g = g.simultaneousWithExternalGesture(joystickGesture as never);
    }
    return g;
  }, [enabled, joystickGesture, onTap]);

  const baseStyle =
    kind === 'hit'
      ? styles.ctrlCircleHit
      : kind === 'dash'
        ? styles.ctrlCircleDash
        : styles.ctrlCircleJump;

  return (
    <GestureDetector gesture={tap}>
      <View
        accessibilityRole="button"
        style={[
          baseStyle,
          styles.ctrlCircleAbsolute,
          { left, top },
          !enabled && styles.ctrlBtnDisabled,
          pressed && styles.ctrlPressed,
        ]}
      >
        <View style={styles.ctrlCircleGloss} pointerEvents="none" />
        <Text style={styles.ctrlCircleLabel}>{label}</Text>
        {subLabel ? <Text style={styles.ctrlCircleSub}>{subLabel}</Text> : null}
      </View>
    </GestureDetector>
  );
}
