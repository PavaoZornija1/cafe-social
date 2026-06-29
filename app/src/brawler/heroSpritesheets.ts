import type { HeroSpriteConfig } from './heroSpriteTypes';
import { VESPERA_HERO_SPRITE_CONFIG } from './boltSpritesheet';
import { GORGON_HERO_SPRITE_CONFIG } from './bruiserSpritesheet';
import { IGNIS_ARENA_HERO_ID, MAGE_HERO_SPRITE_CONFIG } from './mageSpritesheet';
import { TARIEL_HERO_SPRITE_CONFIG } from './riftSpritesheet';
import {
  TESTER_GOLEM_ARENA_HERO_ID,
  TESTER_GOLEM_HERO_SPRITE_CONFIG,
} from './testerGolemSpritesheet';

const ARENA_HERO_SPRITES: Record<string, HeroSpriteConfig> = {
  [GORGON_HERO_SPRITE_CONFIG.heroId]: GORGON_HERO_SPRITE_CONFIG,
  [TARIEL_HERO_SPRITE_CONFIG.heroId]: TARIEL_HERO_SPRITE_CONFIG,
  [VESPERA_HERO_SPRITE_CONFIG.heroId]: VESPERA_HERO_SPRITE_CONFIG,
  [MAGE_HERO_SPRITE_CONFIG.heroId]: MAGE_HERO_SPRITE_CONFIG,
  [TESTER_GOLEM_HERO_SPRITE_CONFIG.heroId]: TESTER_GOLEM_HERO_SPRITE_CONFIG,
};

/** Temporary: heroes shown on the lobby picker while strip art is WIP. */
export const LOBBY_SELECTABLE_HERO_IDS = [
  IGNIS_ARENA_HERO_ID,
  TESTER_GOLEM_ARENA_HERO_ID,
] as const;

export function isLobbySelectableHero(heroId: string | null | undefined): boolean {
  return (
    heroId != null &&
    (LOBBY_SELECTABLE_HERO_IDS as readonly string[]).includes(heroId)
  );
}

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
