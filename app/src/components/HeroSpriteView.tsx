import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { HeroSpriteAnim, HeroSpriteConfig } from '../brawler/heroSpriteTypes';
import { getStripForAnim, usesStripSprites } from '../brawler/heroSpriteUtils';

export type { HeroSpriteAnim };

type Props = {
  config: HeroSpriteConfig;
  anim: HeroSpriteAnim;
  walkFrame: number;
  hitFrame: number;
  idleFrame: number;
  jumpFrame: number;
  dashFrame: number;
  facing: 'left' | 'right';
  scale?: number;
};

type ClipRect = {
  source: NonNullable<HeroSpriteConfig['source']>;
  sx: number;
  sy: number;
  clipW: number;
  clipH: number;
  sheetW: number;
  sheetH: number;
};

function resolveSheetClip(
  config: HeroSpriteConfig,
  anim: HeroSpriteAnim,
  facing: 'left' | 'right',
  walkFrame: number,
  hitFrame: number,
): ClipRect {
  const { w: fw, h: fh } = config.framePx;
  const cells = config.anim!;
  const sheetPx = config.sheetPx!;

  if (anim === 'hit') {
    const strip =
      facing === 'right' ? cells.attackRight : cells.attackLeft;
    if (strip) {
      const col = strip.startCol + (hitFrame % strip.frameCount);
      return {
        source: config.source!,
        sx: col * fw,
        sy: strip.row * fh,
        clipW: fw,
        clipH: fh,
        sheetW: sheetPx.width,
        sheetH: sheetPx.height,
      };
    }
    const cell = facing === 'right' ? cells.dashRight : cells.dashLeft;
    return {
      source: config.source!,
      sx: cell.col * fw,
      sy: cell.row * fh,
      clipW: fw,
      clipH: fh,
      sheetW: sheetPx.width,
      sheetH: sheetPx.height,
    };
  }
  if (anim === 'dash') {
    const cell = facing === 'right' ? cells.dashRight : cells.dashLeft;
    return {
      source: config.source!,
      sx: cell.col * fw,
      sy: cell.row * fh,
      clipW: fw,
      clipH: fh,
      sheetW: sheetPx.width,
      sheetH: sheetPx.height,
    };
  }
  if (anim === 'jump') {
    const cell = facing === 'right' ? cells.jumpRight : cells.jumpLeft;
    return {
      source: config.source!,
      sx: cell.col * fw,
      sy: cell.row * fh,
      clipW: fw,
      clipH: fh,
      sheetW: sheetPx.width,
      sheetH: sheetPx.height,
    };
  }
  if (anim === 'walk') {
    const def = facing === 'right' ? cells.walkRight : cells.walkLeft;
    const col = def.startCol + (walkFrame % def.frameCount);
    return {
      source: config.source!,
      sx: col * fw,
      sy: def.row * fh,
      clipW: fw,
      clipH: fh,
      sheetW: sheetPx.width,
      sheetH: sheetPx.height,
    };
  }
  const cell = facing === 'right' ? cells.idleRight : cells.idleLeft;
  return {
    source: config.source!,
    sx: cell.col * fw,
    sy: cell.row * fh,
    clipW: fw,
    clipH: fh,
    sheetW: sheetPx.width,
    sheetH: sheetPx.height,
  };
}

function resolveStripClip(
  config: HeroSpriteConfig,
  anim: HeroSpriteAnim,
  facing: 'left' | 'right',
  walkFrame: number,
  hitFrame: number,
  idleFrame: number,
  jumpFrame: number,
  dashFrame: number,
): ClipRect {
  const { w: fw, h: fh } = config.framePx;
  const strip = getStripForAnim(config, anim, facing)!;
  let frameIndex = 0;
  if (anim === 'walk') frameIndex = walkFrame;
  else if (anim === 'hit') frameIndex = hitFrame;
  else if (anim === 'idle') frameIndex = idleFrame;
  else if (anim === 'jump') frameIndex = jumpFrame;
  else if (anim === 'dash') frameIndex = dashFrame;
  const col = frameIndex % strip.frameCount;
  const sheetW = strip.frameCount * fw;
  return {
    source: strip.source,
    sx: col * fw,
    sy: 0,
    clipW: fw,
    clipH: fh,
    sheetW,
    sheetH: fh,
  };
}

export function HeroSpriteView({
  config,
  anim,
  walkFrame,
  hitFrame,
  idleFrame,
  jumpFrame,
  dashFrame,
  facing,
  scale: scaleOverride,
}: Props) {
  const scale = scaleOverride ?? config.displayScale;

  const { source, sx, sy, clipW, clipH, sheetW, sheetH } = useMemo(() => {
    if (usesStripSprites(config)) {
      return resolveStripClip(
        config,
        anim,
        facing,
        walkFrame,
        hitFrame,
        idleFrame,
        jumpFrame,
        dashFrame,
      );
    }
    return resolveSheetClip(config, anim, facing, walkFrame, hitFrame);
  }, [anim, config, dashFrame, facing, hitFrame, idleFrame, jumpFrame, walkFrame]);

  const displayW = clipW * scale;
  const displayH = clipH * scale;
  const scaledSheetW = sheetW * scale;
  const scaledSheetH = sheetH * scale;
  const tx = -Math.round(sx * scale);
  const ty = -Math.round(sy * scale);

  return (
    <View
      style={[styles.clip, { width: displayW, height: displayH }]}
      collapsable={false}
      renderToHardwareTextureAndroid
    >
      <Image
        source={source}
        style={{
          width: scaledSheetW,
          height: scaledSheetH,
          transform: [{ translateX: tx }, { translateY: ty }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
