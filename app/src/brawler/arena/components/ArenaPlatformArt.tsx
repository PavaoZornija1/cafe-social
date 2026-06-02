import React from 'react';
import { View } from 'react-native';
import type { PlatformWorld } from '../../arenaPlatforms';
import type { ArenaStyles } from '../styles';

type Props = {
  platforms: PlatformWorld[];
  worldW: number;
  worldH: number;
  styles: Pick<ArenaStyles, 'platformArtClip' | 'platformArtImage'>;
};

/** Visual slabs aligned 1:1 with physics hitboxes from `buildArenaPlatforms`. */
export function ArenaPlatformArt({ platforms, worldW, worldH, styles }: Props) {
  if (worldW < 2 || worldH < 2) return null;
  return (
    <>
      {platforms.map((p, i) => (
        <View
          key={i}
          style={[
            styles.platformArtClip,
            {
              left: p.x,
              top: p.y,
              width: p.w,
              height: p.h,
              backgroundColor: 'rgba(34, 197, 94)',
              borderColor: '#22c55e',
              borderWidth: 2,
            },
          ]}
          accessibilityLabel={`Platform ${i + 1}`}
        />
      ))}
    </>
  );
}
