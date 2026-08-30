import type { BrawlerArenaHeroStats } from '../../navigation/type';

export type Dummy = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  prevY: number;
  onGround: boolean;
  hp: number;
  respawnLeft: number;
  flashLeft: number;
  knockVx: number;
};

export type Enemy = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  prevY: number;
  onGround: boolean;
  hp: number;
  iFramesLeft: number;
  respawnLeft: number;
  flashLeft: number;
  knockVx: number;
  /** Index into `buildArenaPlatforms` / `platformsRef.current`. */
  platformIndex: number;
};

export type BrawlerPowerupDef = {
  id: string;
  displayName: string;
  description?: string | null;
  effectType:
    | 'MOVE_SPEED_MULT'
    | 'ATTACK_DMG_MULT'
    | 'JUMP_MULT'
    | 'DASH_SPEED_MULT'
    | 'DASH_COOLDOWN_MULT'
    | 'HEAL_MAX_HP_PCT';
  magnitude: number;
  durationMs: number;
  spawnWeight: number;
  version?: number;
};

export type SpawnedPowerup = {
  spawnId: string;
  powerupId: string;
  x: number;
  y: number;
  r: number;
};

export type DmgFloat = {
  id: number;
  x: number;
  y: number;
  text: string;
  age: number;
};

export type TrackedParticipant = {
  id: string;
  isBot: boolean;
  botName?: string | null;
  playerId?: string | null;
  displayNameSnapshot?: string | null;
  brawlerHeroId?: string | null;
  leftAt?: string | null;
};

export type BrawlerResultsScoreRow = {
  name: string;
  kills: number;
  deaths: number;
  xpGained: number;
  resultLabel: string;
};

export type ActiveBuff = {
  powerupId: string;
  effectType: BrawlerPowerupDef['effectType'];
  magnitude: number;
  startedAtMs: number;
  endsAtMs: number;
};

export type { BrawlerArenaHeroStats };
