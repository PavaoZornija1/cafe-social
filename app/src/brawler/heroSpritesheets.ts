import type { HeroSpriteConfig } from './heroSpriteTypes';
import { VESPERA_HERO_SPRITE_CONFIG } from './boltSpritesheet';
import { GORGON_HERO_SPRITE_CONFIG } from './bruiserSpritesheet';
import { IGNIS_HERO_SPRITE_CONFIG } from './fireMageSpritesheet';
import { TARIEL_HERO_SPRITE_CONFIG } from './riftSpritesheet';

const ARENA_HERO_SPRITES: Record<string, HeroSpriteConfig> = {
  [GORGON_HERO_SPRITE_CONFIG.heroId]: GORGON_HERO_SPRITE_CONFIG,
  [TARIEL_HERO_SPRITE_CONFIG.heroId]: TARIEL_HERO_SPRITE_CONFIG,
  [VESPERA_HERO_SPRITE_CONFIG.heroId]: VESPERA_HERO_SPRITE_CONFIG,
  [IGNIS_HERO_SPRITE_CONFIG.heroId]: IGNIS_HERO_SPRITE_CONFIG,
};

export const ARENA_SPRITE_HERO_IDS = Object.keys(
  ARENA_HERO_SPRITES,
) as (keyof typeof ARENA_HERO_SPRITES)[];

export function getHeroSpriteConfig(
  heroId: string | null | undefined,
): HeroSpriteConfig | undefined {
  if (!heroId) return undefined;
  return ARENA_HERO_SPRITES[heroId];
}

export function isArenaSpriteHero(heroId: string | null | undefined): boolean {
  return heroId != null && heroId in ARENA_HERO_SPRITES;
}
