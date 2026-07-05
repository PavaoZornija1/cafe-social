import type { ImageSourcePropType } from 'react-native';
import type { HeroSpriteConfig } from './heroSpriteTypes';
import { BLONDEE_HERO_SPRITE_CONFIG } from './blondeeSpritesheet';
import { MAGE_HERO_SPRITE_CONFIG } from './mageSpritesheet';
import { SCIENTIST_HERO_SPRITE_CONFIG } from './scientistSpritesheet';
import { SKATER_HERO_SPRITE_CONFIG } from './skaterSpritesheet';
import { TESTER_GOLEM_HERO_SPRITE_CONFIG } from './testerGolemSpritesheet';

const ARENA_HERO_SPRITES: Record<string, HeroSpriteConfig> = {
  [BLONDEE_HERO_SPRITE_CONFIG.heroId]: BLONDEE_HERO_SPRITE_CONFIG,
  [MAGE_HERO_SPRITE_CONFIG.heroId]: MAGE_HERO_SPRITE_CONFIG,
  [SCIENTIST_HERO_SPRITE_CONFIG.heroId]: SCIENTIST_HERO_SPRITE_CONFIG,
  [SKATER_HERO_SPRITE_CONFIG.heroId]: SKATER_HERO_SPRITE_CONFIG,
  [TESTER_GOLEM_HERO_SPRITE_CONFIG.heroId]: TESTER_GOLEM_HERO_SPRITE_CONFIG,
};

const HERO_LOBBY_AVATARS: Record<string, ImageSourcePropType> = {
  [BLONDEE_HERO_SPRITE_CONFIG.heroId]: require('../../assets/brawlerHeroes/blondee/avatar.webp'),
  [MAGE_HERO_SPRITE_CONFIG.heroId]: require('../../assets/brawlerHeroes/mage/avatar.webp'),
  [SCIENTIST_HERO_SPRITE_CONFIG.heroId]: require('../../assets/brawlerHeroes/scientist/avatar.webp'),
  [SKATER_HERO_SPRITE_CONFIG.heroId]: require('../../assets/brawlerHeroes/skater/avatar.webp'),
  [TESTER_GOLEM_HERO_SPRITE_CONFIG.heroId]: require('../../assets/brawlerHeroes/golem/avatar.webp'),
};

export const ARENA_SPRITE_HERO_IDS = Object.keys(
  ARENA_HERO_SPRITES,
) as (keyof typeof ARENA_HERO_SPRITES)[];

export function isLobbySelectableHero(heroId: string | null | undefined): boolean {
  return heroId != null && heroId in ARENA_HERO_SPRITES;
}

export function getHeroSpriteConfig(
  heroId: string | null | undefined,
): HeroSpriteConfig | undefined {
  if (!heroId) return undefined;
  return ARENA_HERO_SPRITES[heroId];
}

export function isArenaSpriteHero(heroId: string | null | undefined): boolean {
  return heroId != null && heroId in ARENA_HERO_SPRITES;
}

export function getHeroLobbyAvatarSource(
  heroId: string | null | undefined,
): ImageSourcePropType | undefined {
  if (!heroId) return undefined;
  return HERO_LOBBY_AVATARS[heroId];
}
