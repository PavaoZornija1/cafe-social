import React from 'react';
import { Image, View } from 'react-native';
import type { PlatformWorld } from '../../arenaPlatforms';
import type { ArenaMapAssets } from '../arenaMaps';
import type { ArenaStyles } from '../styles';

/**
 * Dirt walk line as a fraction of ledge art height (under the bushes).
 * Raise if feet sit in foliage; lower if floating above the deck.
 */
const LEDGE_WALK_Y_FRAC = 0.38;
/** Ground strip walk line (flat dirt under moss). */
const GROUND_WALK_Y_FRAC = 0.32;

type Props = {
  platforms: PlatformWorld[];
  worldW: number;
  worldH: number;
  mapAssets: ArenaMapAssets;
  styles: Pick<ArenaStyles, 'platformArtClip' | 'platformArtImage'>;
};

/** Visual slabs aligned with physics hitboxes from `buildArenaPlatforms`. */
export function ArenaPlatformArt({ platforms, worldW, worldH, mapAssets, styles }: Props) {
  if (worldW < 2 || worldH < 2) return null;

  const last = platforms.length - 1;
  const { ground, groundW, groundH, ledgeBySize } = mapAssets;

  return (
    <>
      {platforms.map((p, i) => {
        const isGround = i === last;

        if (isGround) {
          const artTop = p.y - GROUND_WALK_Y_FRAC * groundH;
          const artLeft = p.x + (p.w - groundW) / 2;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: artLeft,
                top: artTop,
                width: groundW,
                height: groundH,
                zIndex: 2,
              }}
              accessibilityLabel={`Platform ${i + 1}`}
            >
              <Image
                source={ground}
                fadeDuration={0}
                resizeMode="stretch"
                style={{
                  width: groundW,
                  height: groundH,
                }}
              />
            </View>
          );
        }

        if (p.ledgeSize == null) {
          return (
            <View
              key={i}
              style={[
                styles.platformArtClip,
                {
                  left: p.x,
                  top: p.y,
                  width: p.w,
                  height: Math.min(p.h, 24),
                  backgroundColor: 'rgba(34, 197, 94, 0.85)',
                  borderColor: '#22c55e',
                  borderWidth: 2,
                },
              ]}
              accessibilityLabel={`Platform ${i + 1}`}
            />
          );
        }

        const art = ledgeBySize[p.ledgeSize];
        const artTop = p.y - LEDGE_WALK_Y_FRAC * art.h;
        const artLeft = p.x + (p.w - art.w) / 2;
        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: artLeft,
              top: artTop,
              width: art.w,
              height: art.h,
              zIndex: 2,
            }}
            accessibilityLabel={`Platform ${i + 1}`}
          >
            <Image
              source={art.source}
              fadeDuration={0}
              resizeMode="stretch"
              style={{
                width: art.w,
                height: art.h,
              }}
            />
          </View>
        );
      })}
    </>
  );
}
