import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

type Point = { x: number; y: number };

type Props = {
  from: string;
  to: string;
  style?: StyleProp<ViewStyle>;
  /** Normalized gradient line start (default: top-left). */
  start?: Point;
  /** Normalized gradient line end (default: bottom-right). */
  end?: Point;
};

export default function LinearGradientFill({
  from,
  to,
  style,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: Props) {
  const gradId = useId().replace(/:/g, '');

  return (
    <View style={[StyleSheet.absoluteFillObject, style]} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient
            id={gradId}
            x1={`${start.x * 100}%`}
            y1={`${start.y * 100}%`}
            x2={`${end.x * 100}%`}
            y2={`${end.y * 100}%`}
          >
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
}
