import React from 'react';
import { TESTER_GOLEM_HERO_SPRITE_CONFIG } from '../brawler/testerGolemSpritesheet';
import { HeroSpriteView, type HeroSpriteAnim } from './HeroSpriteView';

export type BruiserSpriteAnim = HeroSpriteAnim;

type Props = Omit<
  React.ComponentProps<typeof HeroSpriteView>,
  'config'
>;

/** @deprecated Use `HeroSpriteView` with `getHeroSpriteConfig(heroId)`. */
export function BruiserSpriteView(props: Props) {
  return <HeroSpriteView config={TESTER_GOLEM_HERO_SPRITE_CONFIG} {...props} />;
}
