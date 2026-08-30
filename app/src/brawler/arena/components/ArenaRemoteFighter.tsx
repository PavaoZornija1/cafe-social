import React, { useMemo } from 'react';
import { View } from 'react-native';
import { HeroSpriteView, type HeroSpriteAnim } from '../../../components/HeroSpriteView';
import { getHeroSpriteConfig } from '../../heroSpritesheets';
import { getBodyScale, getSpriteDrawOffsetY } from '../../heroSpriteUtils';
import { ArenaWorldHealthBar } from './ArenaWorldHealthBar';
import type { RemoteFighterRender } from '../remoteFighters';

type Props = {
  fighter: RemoteFighterRender;
  spriteScale: number;
  bodyW: number;
};

export function ArenaRemoteFighter({ fighter, spriteScale, bodyW }: Props) {
  const heroSprite = useMemo(
    () =>
      fighter.brawlerHeroId
        ? getHeroSpriteConfig(fighter.brawlerHeroId)
        : undefined,
    [fighter.brawlerHeroId],
  );
  const bodyScale = getBodyScale(heroSprite);
  const remoteBodyW = (heroSprite?.framePx.w ?? 64) * bodyScale;
  const spriteDrawOffsetY = getSpriteDrawOffsetY(heroSprite);
  const facing = fighter.facing >= 0 ? 'right' : 'left';
  const anim: HeroSpriteAnim = fighter.alive ? fighter.anim : 'idle';
  const barW = Math.max(52, Math.round(bodyW * 0.95));

  if (!fighter.alive) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: Math.round(fighter.displayX),
        top: Math.round(fighter.displayY + spriteDrawOffsetY),
        opacity: 1,
        zIndex: 5,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: remoteBodyW / 2 - barW / 2,
          top: spriteDrawOffsetY - 11,
          zIndex: 6,
        }}
      >
        <ArenaWorldHealthBar
          hp={fighter.hp}
          maxHp={fighter.maxHp}
          width={barW}
          variant="enemy"
          iFrames={false}
        />
      </View>
      {heroSprite ? (
        <HeroSpriteView
          config={heroSprite}
          anim={anim}
          walkFrame={0}
          idleFrame={0}
          hitFrame={0}
          jumpFrame={0}
          dashFrame={0}
          facing={facing}
          scale={spriteScale}
        />
      ) : (
        <View
          style={{
            width: remoteBodyW,
            height: remoteBodyW,
            backgroundColor: fighter.isBot ? '#dc2626' : '#2563eb',
            borderRadius: 6,
          }}
        />
      )}
    </View>
  );
}
