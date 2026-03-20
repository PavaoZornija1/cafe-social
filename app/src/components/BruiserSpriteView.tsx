import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  BRUISER_ANIM,
  BRUISER_FRAME_PX,
  BRUISER_SHEET_PX,
  BRUISER_WEAPON_HIT,
} from '../brawler/bruiserSpritesheet';

const SHEET_SOURCE = require('../../assets/bruiser-spritesheet.png');

export type BruiserSpriteAnim = 'idle' | 'walk' | 'jump' | 'hit' | 'dash';

type Props = {
  anim: BruiserSpriteAnim;
  /** Walk cycle index 0..frameCount-1 */
  walkFrame: number;
  /** Weapon swing frame index 0..BRUISER_WEAPON_HIT.frameCount-1 */
  hitFrame: number;
  facing: 'left' | 'right';
  /** Scale from sheet pixels to display size (display ≈ frame * scale) */
  scale?: number;
};

export function BruiserSpriteView({
  anim,
  walkFrame,
  hitFrame,
  facing,
  scale = 2,
}: Props) {
  const { sx, sy, clipW, clipH } = useMemo(() => {
    const { w: fw, h: fh } = BRUISER_FRAME_PX;
    // Hit: 5 wide frames per row, not 64px stride — see BRUISER_WEAPON_HIT.frameStarts / frameWidths.
    if (anim === 'hit') {
      const wh = BRUISER_WEAPON_HIT;
      const row = facing === 'right' ? wh.rowRight : wh.rowLeft;
      const fi = hitFrame % wh.frameCount;
      return {
        sx: wh.frameStarts[fi],
        sy: row * fh,
        clipW: wh.frameWidths[fi],
        clipH: wh.frameHeight,
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
  }, [anim, facing, walkFrame, hitFrame]);

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
