import React, { useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { clampArenaCamera } from '../spectateView';

type Props = {
  enabled: boolean;
  worldW: number;
  worldH: number;
  arenaW: number;
  arenaInnerH: number;
  camXRef: React.MutableRefObject<number>;
  camYRef: React.MutableRefObject<number>;
  onCameraChange: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export function ArenaSpectatePanLayer({
  enabled,
  worldW,
  worldH,
  arenaW,
  arenaInnerH,
  camXRef,
  camYRef,
  onCameraChange,
  style,
  children,
}: Props) {
  const panStartRef = useRef({ x: 0, y: 0 });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .runOnJS(true)
        .onBegin(() => {
          panStartRef.current = { x: camXRef.current, y: camYRef.current };
        })
        .onUpdate((e) => {
          const next = clampArenaCamera(
            panStartRef.current.x - e.translationX,
            panStartRef.current.y - e.translationY,
            worldW,
            worldH,
            arenaW,
            arenaInnerH,
          );
          camXRef.current = next.x;
          camYRef.current = next.y;
          onCameraChange();
        }),
    [
      arenaInnerH,
      arenaW,
      camXRef,
      camYRef,
      enabled,
      onCameraChange,
      worldH,
      worldW,
    ],
  );

  if (!enabled) {
    return <View style={[styles.fill, style]}>{children}</View>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.fill, style]}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
