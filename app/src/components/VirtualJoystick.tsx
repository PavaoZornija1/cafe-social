import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

import type { AppColors } from '../theme/colors';
import { useAppTheme } from '../theme/ThemeContext';

const DEFAULT_SIZE = 120;
/** Normalized stick magnitude below this snaps to 0 */
const DEADZONE = 0.1;

export type StickVector = { x: number; y: number };

type Props = {
  /** Mutable stick output — read each frame in game loop (-1..1 each axis). */
  stickRef: React.MutableRefObject<StickVector>;
  size?: number;
  /** When false, touches are ignored and the stick resets to center. */
  enabled?: boolean;
  /** Arena uses horizontal movement only; vertical axis is zeroed. */
  horizontalOnly?: boolean;
  /** When set, knob is driven externally (touch layer); view ignores touches. */
  displayKnob?: { x: number; y: number };
};

function findTouch(
  touches: ReadonlyArray<{
    identifier: string;
    locationX: number;
    locationY: number;
  }>,
  id: string,
) {
  for (let i = 0; i < touches.length; i++) {
    const t = touches[i];
    if (t && t.identifier === id) return t;
  }
  return undefined;
}

/**
 * Native multi-touch joystick — avoids RNGH pan so a second finger can hit
 * action buttons while the stick is held (iOS-friendly).
 */
export function VirtualJoystick({
  stickRef,
  size = DEFAULT_SIZE,
  enabled = true,
  horizontalOnly = true,
  displayKnob,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const knobPos = displayKnob ?? knob;
  const layoutRef = useRef({ w: size, h: size });
  const trackingIdRef = useRef<string | null>(null);
  const knobRadius = Math.max(11, Math.min(24, size * 0.19));
  const ringInset = 12;
  const maxTravel = Math.max(8, size / 2 - knobRadius - 5);

  const applyTouch = useCallback(
    (locationX: number, locationY: number) => {
      const w = layoutRef.current.w;
      const h = layoutRef.current.h;
      const cx = locationX - w / 2;
      const cy = locationY - h / 2;
      const dist = Math.hypot(cx, cy);
      const scale = dist > maxTravel && dist > 0 ? maxTravel / dist : 1;
      const kx = cx * scale;
      const ky = cy * scale;
      let nx = kx / maxTravel;
      let ny = horizontalOnly ? 0 : ky / maxTravel;
      if (horizontalOnly) {
        if (Math.abs(nx) < DEADZONE) {
          nx = 0;
          ny = 0;
          setKnob({ x: 0, y: 0 });
        } else {
          setKnob({ x: kx, y: 0 });
        }
      } else if (Math.hypot(nx, ny) < DEADZONE) {
        nx = 0;
        ny = 0;
        setKnob({ x: 0, y: 0 });
      } else {
        setKnob({ x: kx, y: ky });
      }
      stickRef.current.x = nx;
      stickRef.current.y = ny;
    },
    [horizontalOnly, maxTravel, stickRef],
  );

  const release = useCallback(() => {
    trackingIdRef.current = null;
    stickRef.current.x = 0;
    stickRef.current.y = 0;
    setKnob({ x: 0, y: 0 });
  }, [stickRef]);

  useEffect(() => {
    if (!enabled && displayKnob == null) release();
  }, [displayKnob, enabled, release]);

  const interactive = enabled && displayKnob == null;

  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (!enabled || trackingIdRef.current != null) return;
      const touch = e.nativeEvent.changedTouches[0];
      if (!touch) return;
      trackingIdRef.current = touch.identifier;
      applyTouch(touch.locationX, touch.locationY);
    },
    [applyTouch, enabled],
  );

  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!enabled || trackingIdRef.current == null) return;
      const touch = findTouch(e.nativeEvent.touches, trackingIdRef.current);
      if (!touch) return;
      applyTouch(touch.locationX, touch.locationY);
    },
    [applyTouch, enabled],
  );

  const onTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      if (trackingIdRef.current == null) return;
      const ended = e.nativeEvent.changedTouches;
      for (let i = 0; i < ended.length; i++) {
        if (ended[i]!.identifier === trackingIdRef.current) {
          release();
          return;
        }
      }
    },
    [release],
  );

  return (
    <View
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: size / 2 },
        !enabled && styles.outerDisabled,
      ]}
      onLayout={(ev) => {
        layoutRef.current.w = ev.nativeEvent.layout.width;
        layoutRef.current.h = ev.nativeEvent.layout.height;
      }}
      pointerEvents={interactive ? 'auto' : 'none'}
      onTouchStart={interactive ? onTouchStart : undefined}
      onTouchMove={interactive ? onTouchMove : undefined}
      onTouchEnd={interactive ? onTouchEnd : undefined}
      onTouchCancel={interactive ? onTouchEnd : undefined}
    >
      <View
        pointerEvents="none"
        style={[
          styles.outerHighlight,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: size - ringInset,
            height: size - ringInset,
            borderRadius: (size - ringInset) / 2,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ringInner,
          {
            width: size - ringInset - 14,
            height: size - ringInset - 14,
            borderRadius: (size - ringInset - 14) / 2,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.knob,
          {
            width: knobRadius * 2,
            height: knobRadius * 2,
            borderRadius: knobRadius,
            transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }],
          },
        ]}
      >
        <View style={styles.knobHighlight} pointerEvents="none" />
        <View style={styles.knobCore} pointerEvents="none" />
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    outer: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.20)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.text,
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    outerDisabled: {
      opacity: 0.45,
    },
    outerHighlight: {
      position: 'absolute',
      left: 0,
      top: 0,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.10)',
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    ring: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: 'rgba(226, 232, 240, 0.18)',
      backgroundColor: 'transparent',
    },
    ringInner: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: 'rgba(148, 163, 184, 0.12)',
      backgroundColor: 'transparent',
    },
    knob: {
      position: 'absolute',
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.22)',
      shadowColor: colors.text,
      shadowOpacity: 0.45,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    knobHighlight: {
      position: 'absolute',
      left: 3,
      top: 3,
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    knobCore: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(2, 6, 23, 0.28)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.10)',
    },
  });
}
