import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  PixelRatio,
  StyleSheet,
  View,
} from 'react-native';
import type { HeroSpriteAnim, HeroSpriteConfig } from '../brawler/heroSpriteTypes';
import { getStripForAnim, usesStripSprites } from '../brawler/heroSpriteUtils';

export type { HeroSpriteAnim };

function roundPx(value: number): number {
  return PixelRatio.roundToNearestPixel(value);
}

function getSourceKey(source: ImageSourcePropType): string | number {
  if (typeof source === 'number') return source;
  const resolved = Image.resolveAssetSource(source);
  return resolved?.uri ?? JSON.stringify(source);
}

function layoutForClip(
  clip: ClipRect,
  scale: number,
): {
  displayW: number;
  displayH: number;
  imageStyle: {
    position: 'absolute';
    left: number;
    top: number;
    width: number;
    height: number;
  };
} {
  const displayW = roundPx(clip.clipW * scale);
  const displayH = roundPx(clip.clipH * scale);
  const scaledSheetW = roundPx(clip.sheetW * scale);
  const scaledSheetH = roundPx(clip.sheetH * scale);
  return {
    displayW,
    displayH,
    imageStyle: {
      position: 'absolute',
      left: -roundPx(clip.sx * scale),
      top: -roundPx(clip.sy * scale),
      width: scaledSheetW,
      height: scaledSheetH,
    },
  };
}

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
  source: ImageSourcePropType;
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

function HeroSpriteStripImage({
  clip,
  scale,
}: {
  clip: ClipRect;
  scale: number;
}) {
  const sourceKey = getSourceKey(clip.source);
  const [readyKey, setReadyKey] = useState(sourceKey);
  const readyClipRef = useRef(clip);

  if (sourceKey === readyKey) {
    readyClipRef.current = clip;
  }

  const displayClip = sourceKey === readyKey ? clip : readyClipRef.current;
  const { displayW, displayH, imageStyle } = layoutForClip(displayClip, scale);
  const pendingLayout = layoutForClip(clip, scale);
  const sourceSwapPending = sourceKey !== readyKey;

  return (
    <View
      style={[styles.clip, { width: displayW, height: displayH }]}
      collapsable={false}
    >
      <Image
        key={readyKey}
        source={displayClip.source}
        fadeDuration={0}
        resizeMode="stretch"
        style={imageStyle}
      />
      {sourceSwapPending ? (
        <Image
          key={sourceKey}
          source={clip.source}
          fadeDuration={0}
          resizeMode="stretch"
          onLoad={() => {
            readyClipRef.current = clip;
            setReadyKey(sourceKey);
          }}
          style={[pendingLayout.imageStyle, styles.preloadImage]}
        />
      ) : null}
    </View>
  );
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

  const clip = useMemo(() => {
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

  if (usesStripSprites(config)) {
    return <HeroSpriteStripImage clip={clip} scale={scale} />;
  }

  const { displayW, displayH, imageStyle } = layoutForClip(clip, scale);

  return (
    <View
      style={[styles.clip, { width: displayW, height: displayH }]}
      collapsable={false}
    >
      <Image
        source={clip.source}
        fadeDuration={0}
        resizeMode="stretch"
        style={imageStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  preloadImage: {
    opacity: 0,
    pointerEvents: 'none',
  },
});
