import type { ImageSourcePropType } from 'react-native';

/** Folder names under `assets/maps/brawlerHeroes/`. */
export type ArenaMapId = 'mossy_cavern' | 'desert_plains';

/** Lobby override: force a map or let the client roll one. */
export type ArenaMapChoice = ArenaMapId | 'random';

export type ArenaMapLedgeArt = {
  source: ImageSourcePropType;
  w: number;
  h: number;
};

export type ArenaMapAssets = {
  skyPanels: readonly [ImageSourcePropType, ImageSourcePropType, ImageSourcePropType];
  skyW: number;
  skyH: number;
  ground: ImageSourcePropType;
  groundW: number;
  groundH: number;
  ledgeBySize: {
    s: ArenaMapLedgeArt;
    m: ArenaMapLedgeArt;
  };
};

export type ArenaMapDef = {
  id: ArenaMapId;
  /** i18n key under `brawlerLobby.maps.*` */
  nameKey: string;
  assets: ArenaMapAssets;
};

const SKY_W = 512;
const SKY_H = 512;
const GROUND_W = 1920;
const GROUND_H = 64;
const LEDGE_S_W = 160;
const LEDGE_S_H = 48;
const LEDGE_M_W = 224;
const LEDGE_M_H = 48;

/** Shared mossy cavern pack (also temporary stand-in for desert_plains). */
const MOSSY_CAVERN_ASSETS: ArenaMapAssets = {
  // left → center → right = panel 2 / 1 / 3
  skyPanels: [
    require('../../../assets/maps/brawlerHeroes/mossy_cavern/panel_2.png'),
    require('../../../assets/maps/brawlerHeroes/mossy_cavern/panel_1.png'),
    require('../../../assets/maps/brawlerHeroes/mossy_cavern/panel_3.png'),
  ],
  skyW: SKY_W,
  skyH: SKY_H,
  ground: require('../../../assets/maps/brawlerHeroes/mossy_cavern/ground.webp'),
  groundW: GROUND_W,
  groundH: GROUND_H,
  ledgeBySize: {
    s: {
      source: require('../../../assets/maps/brawlerHeroes/mossy_cavern/ledge_s.webp'),
      w: LEDGE_S_W,
      h: LEDGE_S_H,
    },
    m: {
      source: require('../../../assets/maps/brawlerHeroes/mossy_cavern/ledge_m.webp'),
      w: LEDGE_M_W,
      h: LEDGE_M_H,
    },
  },
};

/**
 * Desert plains — drop matching filenames into `desert_plains/` then point these
 * requires at that folder (same layout as mossy_cavern).
 */
const DESERT_PLAINS_ASSETS: ArenaMapAssets = MOSSY_CAVERN_ASSETS;

export const ARENA_MAPS: Record<ArenaMapId, ArenaMapDef> = {
  mossy_cavern: {
    id: 'mossy_cavern',
    nameKey: 'mossyCavern',
    assets: MOSSY_CAVERN_ASSETS,
  },
  desert_plains: {
    id: 'desert_plains',
    nameKey: 'desertPlains',
    assets: DESERT_PLAINS_ASSETS,
  },
};

export const ARENA_MAP_IDS = Object.keys(ARENA_MAPS) as ArenaMapId[];

export const DEFAULT_ARENA_MAP_ID: ArenaMapId = 'mossy_cavern';

export function isArenaMapId(value: string | null | undefined): value is ArenaMapId {
  return value != null && value in ARENA_MAPS;
}

export function pickRandomArenaMapId(): ArenaMapId {
  const idx = Math.floor(Math.random() * ARENA_MAP_IDS.length);
  return ARENA_MAP_IDS[idx] ?? DEFAULT_ARENA_MAP_ID;
}

/** Resolve lobby choice (including `random`) to a concrete map for this match. */
export function resolveArenaMapId(choice: ArenaMapChoice | null | undefined): ArenaMapId {
  if (choice == null || choice === 'random') return pickRandomArenaMapId();
  return isArenaMapId(choice) ? choice : DEFAULT_ARENA_MAP_ID;
}

export function getArenaMapAssets(mapId: ArenaMapId | null | undefined): ArenaMapAssets {
  const id = isArenaMapId(mapId) ? mapId : DEFAULT_ARENA_MAP_ID;
  return ARENA_MAPS[id].assets;
}
