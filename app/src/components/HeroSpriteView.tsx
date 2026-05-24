import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { HeroSpriteAnim, HeroSpriteConfig } from '../brawler/heroSpriteTypes';

export type { HeroSpriteAnim };

type Props = {
  config: HeroSpriteConfig;
  anim: HeroSpriteAnim;
  walkFrame: number;
  hitFrame: number;
  facing: 'left' | 'right';
  scale?: number;
};

export function HeroSpriteView({
  config,
  anim,
  walkFrame,
  hitFrame,
  facing,
  scale: scaleOverride,
}: Props) {
  const scale = scaleOverride ?? config.displayScale;

  const { sx, sy, clipW, clipH } = useMemo(() => {
    const { w: fw, h: fh } = config.framePx;
    const { anim: cells } = config;

    if (anim === 'hit') {
      const strip =
        facing === 'right' ? cells.attackRight : cells.attackLeft;
      if (strip) {
        const col = strip.startCol + (hitFrame % strip.frameCount);
        return { sx: col * fw, sy: strip.row * fh, clipW: fw, clipH: fh };
      }
      const cell =
        facing === 'right' ? cells.dashRight : cells.dashLeft;
      return {
        sx: cell.col * fw,
        sy: cell.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    if (anim === 'dash') {
      const cell =
        facing === 'right' ? cells.dashRight : cells.dashLeft;
      return {
        sx: cell.col * fw,
        sy: cell.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    if (anim === 'jump') {
      const cell =
        facing === 'right' ? cells.jumpRight : cells.jumpLeft;
      return {
        sx: cell.col * fw,
        sy: cell.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    if (anim === 'walk') {
      const def =
        facing === 'right' ? cells.walkRight : cells.walkLeft;
      const col = def.startCol + (walkFrame % def.frameCount);
      return {
        sx: col * fw,
        sy: def.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    const cell =
      facing === 'right' ? cells.idleRight : cells.idleLeft;
    return {
      sx: cell.col * fw,
      sy: cell.row * fh,
      clipW: fw,
      clipH: fh,
    };
  }, [anim, config, facing, hitFrame, walkFrame]);

  const displayW = clipW * scale;
  const displayH = clipH * scale;
  const sheetW = config.sheetPx.width * scale;
  const sheetH = config.sheetPx.height * scale;
  const tx = -Math.round(sx * scale);
  const ty = -Math.round(sy * scale);

  return (
    <View
      style={[styles.clip, { width: displayW, height: displayH }]}
      collapsable={false}
      renderToHardwareTextureAndroid
    >
      <Image
        source={config.source}
        style={{
          width: sheetW,
          height: sheetH,
          transform: [{ translateX: tx }, { translateY: ty }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
