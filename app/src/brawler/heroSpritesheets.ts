import type { HeroSpriteConfig } from './heroSpriteTypes';
import { VESPERA_HERO_SPRITE_CONFIG } from './boltSpritesheet';
import { GORGON_HERO_SPRITE_CONFIG } from './bruiserSpritesheet';
import { MAGE_HERO_SPRITE_CONFIG } from './mageSpritesheet';
import { TARIEL_HERO_SPRITE_CONFIG } from './riftSpritesheet';
import { SCIENTIST_HERO_SPRITE_CONFIG } from './scientistSpritesheet';
import { TESTER_GOLEM_HERO_SPRITE_CONFIG } from './testerGolemSpritesheet';

const ARENA_HERO_SPRITES: Record<string, HeroSpriteConfig> = {
  [GORGON_HERO_SPRITE_CONFIG.heroId]: GORGON_HERO_SPRITE_CONFIG,
  [TARIEL_HERO_SPRITE_CONFIG.heroId]: TARIEL_HERO_SPRITE_CONFIG,
  [VESPERA_HERO_SPRITE_CONFIG.heroId]: VESPERA_HERO_SPRITE_CONFIG,
  [MAGE_HERO_SPRITE_CONFIG.heroId]: MAGE_HERO_SPRITE_CONFIG,
  [SCIENTIST_HERO_SPRITE_CONFIG.heroId]: SCIENTIST_HERO_SPRITE_CONFIG,
  [TESTER_GOLEM_HERO_SPRITE_CONFIG.heroId]: TESTER_GOLEM_HERO_SPRITE_CONFIG,
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
