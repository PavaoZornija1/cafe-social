import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const DEFAULT_SIZE = 120;
/** Normalized stick magnitude below this snaps to 0 */
const DEADZONE = 0.14;

export type StickVector = { x: number; y: number };

type Props = {
  /** Mutable stick output — read each frame in game loop (-1..1 each axis). */
  stickRef: React.MutableRefObject<StickVector>;
  size?: number;
  /** When false, touches are ignored and the stick resets to center. */
  enabled?: boolean;
};

/**
 * Touch joystick: updates `stickRef` on drag; vertical is available for future
 * use (e.g. aim); arena currently uses horizontal only.
 */
export function VirtualJoystick({
  stickRef,
  size = DEFAULT_SIZE,
  enabled = true,
}: Props) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const layoutRef = useRef({ w: size, h: size });
  const knobRadius = Math.max(11, Math.min(24, size * 0.19));
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
      let ny = ky / maxTravel;
      if (Math.hypot(nx, ny) < DEADZONE) {
        nx = 0;
        ny = 0;
        setKnob({ x: 0, y: 0 });
      } else {
        setKnob({ x: kx, y: ky });
      }
      stickRef.current.x = nx;
      stickRef.current.y = ny;
    },
    [maxTravel, stickRef],
  );

  const release = useCallback(() => {
    stickRef.current.x = 0;
    stickRef.current.y = 0;
    setKnob({ x: 0, y: 0 });
  }, [stickRef]);

  useEffect(() => {
    if (!enabled) release();
  }, [enabled, release]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enabled,
        onMoveShouldSetPanResponder: () => enabled,
        onPanResponderGrant: (e) => {
          if (!enabled) return;
          applyTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderMove: (e) => {
          if (!enabled) return;
          applyTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderRelease: release,
        onPanResponderTerminate: release,
      }),
    [applyTouch, enabled, release],
  );

  return (
    <View
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: size / 2 },
        !enabled && styles.outerDisabled,
      ]}
      onLayout={(e) => {
        layoutRef.current.w = e.nativeEvent.layout.width;
        layoutRef.current.h = e.nativeEvent.layout.height;
      }}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.ring,
          {
            width: size - 12,
            height: size - 12,
            borderRadius: (size - 12) / 2,
          },
        ]}
      />
      <View
        style={[
          styles.knob,
          {
            width: knobRadius * 2,
            height: knobRadius * 2,
            borderRadius: knobRadius,
            transform: [{ translateX: knob.x }, { translateY: knob.y }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerDisabled: {
    opacity: 0.45,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#0f172a',
  },
  knob: {
    position: 'absolute',
    backgroundColor: '#7c3aed',
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
});
