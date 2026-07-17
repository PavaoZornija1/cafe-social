import type { RefObject } from 'react';
import type { View } from 'react-native';
import type { ArenaWorldPaintFrame } from './arenaWorldPaint';

export type ArenaWorldPaintNodes = {
  worldLayer: RefObject<View | null>;
  skyMotion: RefObject<View | null>;
  heroWrap: RefObject<View | null>;
  heroBarWrap: RefObject<View | null>;
  lava: RefObject<View | null>;
  hitbox: RefObject<View | null>;
  enemyNodes: RefObject<Array<View | null>>;
};

/** Imperative RAF paint for camera + entity positions (avoids React 60fps re-renders). */
export function applyArenaWorldPaint(
  nodes: ArenaWorldPaintNodes,
  frame: ArenaWorldPaintFrame,
): void {
  nodes.worldLayer.current?.setNativeProps({
    style: {
      transform: [
        { translateX: -frame.camX },
        { translateY: -frame.camY },
      ],
    },
  });
  nodes.skyMotion.current?.setNativeProps({
    style: {
      transform: [
        { translateX: -frame.camX * 0.18 },
        { translateY: -frame.camY * 0.1 },
      ],
    },
  });
  const barW = Math.max(52, Math.round(frame.bodyW * 0.95));
  nodes.heroWrap.current?.setNativeProps({
    style: {
      left: Math.round(frame.px - frame.hitDrawOffsetX),
      top: Math.round(frame.py + frame.spriteDrawOffsetY),
    },
  });
  nodes.heroBarWrap.current?.setNativeProps({
    style: {
      left: frame.px + frame.bodyW / 2 - barW / 2,
      top: frame.py + frame.spriteDrawOffsetY - 11,
    },
  });
  frame.enemies.forEach((e, idx) => {
    const node = nodes.enemyNodes.current[idx];
    if (!node) return;
    node.setNativeProps({
      style: {
        left: e.x,
        top: e.y,
        opacity: e.visible ? 1 : 0,
        backgroundColor: e.flash ? '#fca5a5' : '#dc2626',
      },
    });
  });
  if (frame.lavaSurfaceY == null) {
    nodes.lava.current?.setNativeProps({ style: { opacity: 0 } });
  } else {
    nodes.lava.current?.setNativeProps({
      style: {
        opacity: 1,
        top: frame.lavaSurfaceY,
        height: Math.max(0, frame.worldH - frame.lavaSurfaceY),
      },
    });
  }
  if (frame.debugHit) {
    nodes.hitbox.current?.setNativeProps({
      style: {
        opacity: 1,
        left: frame.debugHit.x,
        top: frame.debugHit.y,
      },
    });
  } else {
    nodes.hitbox.current?.setNativeProps({ style: { opacity: 0 } });
  }
}
