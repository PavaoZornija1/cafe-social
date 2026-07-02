import React, { useCallback, useRef, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { VirtualJoystick } from '../../../components/VirtualJoystick';
import { ACTION_ARC_LAYOUT } from '../actionArc';
import type { ArenaSafeInsets } from '../arenaSafeArea';
import {
  ACTION_ARC_H,
  ACTION_ARC_W,
  ACTION_CONTROLS_BOTTOM_GUTTER,
  ACTION_CONTROLS_LEFT_GUTTER,
  ACTION_CIRCLE_SIZE,
  DROP_THROUGH_JOY_THRESHOLD,
  JOYSTICK_SIZE,
} from '../constants';
import type { ArenaStyles } from '../styles';
import { ActionTapButton } from './ActionTapButton';

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  styles: ArenaStyles;
  safeInsets: ArenaSafeInsets;
  actionArcRight: number;
  controlsLive: boolean;
  dashReady: boolean;
  dashCooldownProgress: number;
  dashCooldownSecondsLeft: number;
  controlLabels: { hit: string; dash: string; jump: string; dashCd: string };
  joyRef: React.MutableRefObject<{ x: number; y: number }>;
  onHitTap: () => void;
  onDashTap: () => void;
  onJumpTap: () => void;
};

const BTN_PAD = 14;

function expandRect(r: Rect, pad: number): Rect {
  return {
    left: r.left - pad,
    top: r.top - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
}

function findTouch(
  touches: ReadonlyArray<{ identifier: string; locationX: number; locationY: number }>,
  id: string,
) {
  for (let i = 0; i < touches.length; i++) {
    if (touches[i]!.identifier === id) return touches[i];
  }
  return undefined;
}

export function ArenaControlTouchLayer({
  styles,
  safeInsets,
  actionArcRight,
  controlsLive,
  dashReady,
  dashCooldownProgress,
  dashCooldownSecondsLeft,
  controlLabels,
  joyRef,
  onHitTap,
  onDashTap,
  onJumpTap,
}: Props) {
  const layoutRef = useRef({ w: 0, h: 0 });
  const joyTouchIdRef = useRef<string | null>(null);
  const joyCenterRef = useRef({ cx: 0, cy: 0 });
  const maxTravelRef = useRef(48);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const [pressedKind, setPressedKind] = useState<'hit' | 'dash' | 'jump' | null>(null);

  const computeRects = useCallback((): {
    joy: Rect;
    joyVisual: Rect;
    hit: Rect;
    dash: Rect;
    jump: Rect;
  } => {
    const { w, h } = layoutRef.current;
    const joyVisual: Rect = {
      left: safeInsets.left + ACTION_CONTROLS_LEFT_GUTTER,
      top: Math.max(0, h - safeInsets.bottom - JOYSTICK_SIZE),
      width: JOYSTICK_SIZE,
      height: JOYSTICK_SIZE,
    };
    const arcLeft = Math.max(0, w - actionArcRight - ACTION_ARC_W);
    const arcTop = Math.max(0, h - safeInsets.bottom - ACTION_CONTROLS_BOTTOM_GUTTER - ACTION_ARC_H);
    const mkBtn = (idx: number): Rect => {
      const pos = ACTION_ARC_LAYOUT[idx]!;
      return {
        left: arcLeft + pos.left,
        top: arcTop + pos.top,
        width: ACTION_CIRCLE_SIZE,
        height: ACTION_CIRCLE_SIZE,
      };
    };
    return {
      joy: expandRect(joyVisual, 8),
      joyVisual,
      hit: expandRect(mkBtn(0), BTN_PAD),
      dash: expandRect(mkBtn(1), BTN_PAD),
      jump: expandRect(mkBtn(2), BTN_PAD),
    };
  }, [actionArcRight, safeInsets.bottom, safeInsets.left]);

  const applyJoyAt = useCallback(
    (locationX: number, locationY: number, joyRect: Rect) => {
      const cx = joyRect.left + joyRect.width / 2;
      const cy = joyRect.top + joyRect.height / 2;
      joyCenterRef.current = { cx, cy };
      const knobRadius = Math.max(11, Math.min(24, JOYSTICK_SIZE * 0.19));
      const maxTravel = Math.max(8, JOYSTICK_SIZE / 2 - knobRadius - 5);
      maxTravelRef.current = maxTravel;

      const kx = locationX - cx;
      const ky = locationY - cy;
      const dist = Math.hypot(kx, ky);
      const scale = dist > maxTravel && dist > 0 ? maxTravel / dist : 1;
      const sx = kx * scale;
      const sy = ky * scale;
      let nx = sx / maxTravel;
      let ny = sy / maxTravel;
      if (Math.abs(nx) < 0.1) nx = 0;
      if (ny < DROP_THROUGH_JOY_THRESHOLD) ny = 0;
      if (nx === 0 && ny === 0) {
        setJoyKnob({ x: 0, y: 0 });
      } else {
        setJoyKnob({ x: sx, y: ny > 0 ? sy : 0 });
      }
      joyRef.current.x = nx;
      joyRef.current.y = ny;
    },
    [joyRef],
  );

  const releaseJoy = useCallback(() => {
    joyTouchIdRef.current = null;
    joyRef.current.x = 0;
    joyRef.current.y = 0;
    setJoyKnob({ x: 0, y: 0 });
  }, [joyRef]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    layoutRef.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  }, []);

  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (!controlsLive) return;
      const rects = computeRects();
      const changed = e.nativeEvent.changedTouches;
      for (let i = 0; i < changed.length; i++) {
        const t = changed[i]!;
        const x = t.locationX;
        const y = t.locationY;

        if (joyTouchIdRef.current == null && pointInRect(x, y, rects.joy)) {
          joyTouchIdRef.current = t.identifier;
          applyJoyAt(x, y, rects.joyVisual);
          continue;
        }
        if (pointInRect(x, y, rects.hit)) {
          setPressedKind('hit');
          onHitTap();
        } else if (pointInRect(x, y, rects.jump)) {
          setPressedKind('jump');
          onJumpTap();
        } else if (pointInRect(x, y, rects.dash) && dashReady) {
          setPressedKind('dash');
          onDashTap();
        }
      }
    },
    [applyJoyAt, computeRects, controlsLive, dashReady, onDashTap, onHitTap, onJumpTap],
  );

  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!controlsLive || joyTouchIdRef.current == null) return;
      const touch = findTouch(e.nativeEvent.touches, joyTouchIdRef.current);
      if (!touch) return;
      const rects = computeRects();
      applyJoyAt(touch.locationX, touch.locationY, rects.joyVisual);
    },
    [applyJoyAt, computeRects, controlsLive],
  );

  const onTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      const changed = e.nativeEvent.changedTouches;
      for (let i = 0; i < changed.length; i++) {
        const t = changed[i]!;
        if (t.identifier === joyTouchIdRef.current) {
          releaseJoy();
        }
      }
      setPressedKind(null);
    },
    [releaseJoy],
  );

  return (
    <View
      style={[styles.controlsTouchLayer, { paddingBottom: safeInsets.bottom }]}
      pointerEvents={controlsLive ? 'auto' : 'none'}
      onLayout={onLayout}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <View
        style={[
          styles.controlsJoystickCluster,
          { paddingLeft: safeInsets.left + ACTION_CONTROLS_LEFT_GUTTER },
        ]}
        pointerEvents="none"
      >
        <VirtualJoystick
          stickRef={joyRef}
          size={JOYSTICK_SIZE}
          enabled
          horizontalOnly
          displayKnob={joyKnob}
        />
      </View>
      <View
        style={[
          styles.actionArcWrap,
          {
            right: actionArcRight,
            bottom: ACTION_CONTROLS_BOTTOM_GUTTER,
          },
        ]}
        pointerEvents="none"
      >
        <ActionTapButton
          kind="hit"
          enabled={controlsLive}
          label={controlLabels.hit}
          left={ACTION_ARC_LAYOUT[0]!.left}
          top={ACTION_ARC_LAYOUT[0]!.top}
          styles={styles}
          pressed={pressedKind === 'hit'}
        />
        <ActionTapButton
          kind="dash"
          enabled={controlsLive && dashReady}
          label={controlLabels.dash}
          left={ACTION_ARC_LAYOUT[1]!.left}
          top={ACTION_ARC_LAYOUT[1]!.top}
          styles={styles}
          pressed={pressedKind === 'dash'}
          dashCooldownProgress={dashCooldownProgress}
          dashCooldownSecondsLeft={dashCooldownSecondsLeft}
        />
        <ActionTapButton
          kind="jump"
          enabled={controlsLive}
          label={controlLabels.jump}
          left={ACTION_ARC_LAYOUT[2]!.left}
          top={ACTION_ARC_LAYOUT[2]!.top}
          styles={styles}
          pressed={pressedKind === 'jump'}
        />
      </View>
    </View>
  );
}
