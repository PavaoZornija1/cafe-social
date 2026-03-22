import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  BRUISER_ANIM,
  BRUISER_FRAME_PX,
  BRUISER_SHEET_PX,
} from '../brawler/bruiserSpritesheet';

const SHEET_SOURCE = require('../../assets/bruiser-spritesheet.png');

export type BruiserSpriteAnim = 'idle' | 'walk' | 'jump' | 'hit' | 'dash';

type Props = {
  anim: BruiserSpriteAnim;
  /** Walk cycle index 0..frameCount-1 */
  walkFrame: number;
  /** Unused while hit reuses dash pose; kept for arena timing API */
  hitFrame: number;
  facing: 'left' | 'right';
  /** Scale from sheet pixels to display size (display ≈ frame * scale) */
  scale?: number;
};

export function BruiserSpriteView({
  anim,
  walkFrame,
  hitFrame: _hitFrame,
  facing,
  scale = 2,
}: Props) {
  const { sx, sy, clipW, clipH } = useMemo(() => {
    const { w: fw, h: fh } = BRUISER_FRAME_PX;
    // Hit: temporarily same graphic as dash facing right (`dashRight`).
    if (anim === 'hit') {
      const cell = BRUISER_ANIM.dashRight;
      return {
        sx: cell.col * fw,
        sy: cell.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    if (anim === 'dash') {
      const cell =
        facing === 'right' ? BRUISER_ANIM.dashRight : BRUISER_ANIM.dashLeft;
      return {
        sx: cell.col * fw,
        sy: cell.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    if (anim === 'jump') {
      const cell =
        facing === 'right' ? BRUISER_ANIM.jumpRight : BRUISER_ANIM.jumpLeft;
      return {
        sx: cell.col * fw,
        sy: cell.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    if (anim === 'walk') {
      const def =
        facing === 'right' ? BRUISER_ANIM.walkRight : BRUISER_ANIM.walkLeft;
      const col = def.startCol + (walkFrame % def.frameCount);
      return {
        sx: col * fw,
        sy: def.row * fh,
        clipW: fw,
        clipH: fh,
      };
    }
    const cell =
      facing === 'right' ? BRUISER_ANIM.idleRight : BRUISER_ANIM.idleLeft;
    return {
      sx: cell.col * fw,
      sy: cell.row * fh,
      clipW: fw,
      clipH: fh,
    };
  }, [anim, facing, walkFrame]);

  const displayW = clipW * scale;
  const displayH = clipH * scale;
  const sheetW = BRUISER_SHEET_PX.width * scale;
  const sheetH = BRUISER_SHEET_PX.height * scale;
  // Integer pixel transforms avoid subpixel sampling flicker (common when dashing / fast move).
  const tx = -Math.round(sx * scale);
  const ty = -Math.round(sy * scale);

  return (
    <View
      style={[styles.clip, { width: displayW, height: displayH }]}
      collapsable={false}
      renderToHardwareTextureAndroid
    >
      <Image
        source={SHEET_SOURCE}
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
