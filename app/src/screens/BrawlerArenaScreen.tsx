import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BruiserSpriteView, type BruiserSpriteAnim } from '../components/BruiserSpriteView';
import { VirtualJoystick } from '../components/VirtualJoystick';
import {
  BRUISER_ANIM,
  BRUISER_ARENA_HERO_ID,
  BRUISER_FRAME_PX,
  BRUISER_HIT_ANCHOR_OFFSET_X,
  BRUISER_HIT_FINE_OFFSET_SHEET_PX,
} from '../brawler/bruiserSpritesheet';
import {
  buildArenaPlatforms,
  HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
  HERO_FEET_EMBED_GROUND_PLATFORM_PX,
  spawnOnBottomPlatform,
  type PlatformWorld,
} from '../brawler/arenaPlatforms';
import type { BrawlerArenaHeroStats, RootStackParamList } from '../navigation/type';
import { useAppTheme } from '../theme/ThemeContext';
import type { AppColors } from '../theme/colors';

type Dummy = {
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

type Enemy = {
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

/** Mossy tile — one stretched strip per platform hitbox. */
const ARENA_MAP_BG = require('../../assets/Mossy - FloatingPlatforms.png');
/** Distant sky behind platforms and hero. */
const ARENA_SKY_LOTTIE = require('../../assets/lottie/Underwater Ocean Fish and Turtle.json');

const ACTION_CIRCLE_SIZE = 66;

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerArena'>;

/** Walk speed when DB `moveSpeed` multiplier is 1.0 (legacy arena tuning). */
const BASE_MOVE_SPEED_PX = 260;
const GRAVITY = 2200;
const JUMP_VELOCITY = -640;
const GROUND_STRIP_H = 40;
/** Hero scale (~25% smaller than prior 1.65). */
const SPRITE_SCALE = 1.65 * 0.75;
const WALK_FRAME_MS = 140;

const DUMMY_W = 52;
const DUMMY_H = 52;
const DUMMY_HP_MAX = 100;
const DUMMY_RESPAWN_DELAY_S = 1.2;

const HERO_IFRAMES_S = 0.65;
const ENEMY_CONTACT_DMG = 10;

const ENEMY_HP_MAX = 60;
const ENEMY_IFRAMES_S = 0.25;
const ENEMY_RESPAWN_DELAY_S = 1.4;

const ENEMY_W = 46;
const ENEMY_H = 46;
const ENEMY_SPEED = 45;

const ATTACK_HIT_W = 46;
const ATTACK_HIT_H = 34;
/** How far in front of the hero the hitbox starts (px). */
const ATTACK_HIT_FORWARD = 10;
/** Vertical placement of hitbox relative to hero (px from top). */
const ATTACK_HIT_Y_FROM_TOP = 18;

const DEFAULT_SHOW_ATTACK_HITBOX_DEBUG = true;

const DMG_FLOAT_LIFETIME_S = 0.65;
const DMG_FLOAT_RISE_PX = 26;

/**
 * Dev toggle: disable pre-match + match timer so the arena never ends.
 * Useful while iterating on map/platform layout.
 */
const DEFAULT_MATCH_TIMER_ENABLED = false;

const ATTACK_DURATION_S = 0.28;
const DASH_DURATION_S = 0.18;
const DASH_SPEED = 560;

/** Used when `heroStats` is omitted (deep link / older callers). Matches prior hardcoded arena. */
const FALLBACK_ARENA_HERO_STATS: BrawlerArenaHeroStats = {
  baseHp: 100,
  moveSpeed: 1.0,
  dashCooldownMs: 1000,
  attackDamage: 25,
  attackKnockback: 1.0,
};

function arenaHeroCombat(stats: BrawlerArenaHeroStats | undefined) {
  const s: BrawlerArenaHeroStats = { ...FALLBACK_ARENA_HERO_STATS, ...stats };
  const dashCooldownS = Math.max(0.05, s.dashCooldownMs / 1000);
  const dashDmg = Math.round(s.attackDamage * 0.5);
  const dashKnockbackSpeed = DASH_SPEED * s.attackKnockback;
  const dashShovePx = dashKnockbackSpeed * DASH_DURATION_S;
  return {
    baseHp: s.baseHp,
    moveSpeedPx: BASE_MOVE_SPEED_PX * s.moveSpeed,
    dashCooldownS,
    attackDamage: s.attackDamage,
    dashDmg,
    dashKnockbackSpeed,
    dashShovePx,
  };
}

const MARGIN_SCREEN = 20;
const JOYSTICK_SIZE = 124;

const PRE_MATCH_COUNTDOWN_S = 5;
const MATCH_PHASE_CHAOS_END_S = 45;
const MATCH_PHASE_ENDGAME_END_S = 60;
const MATCH_MAX_S = 75;

function formatMatchClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function matchPhaseLabel(elapsed: number): string {
  if (elapsed >= MATCH_PHASE_ENDGAME_END_S) return 'Sudden Death';
  if (elapsed >= MATCH_PHASE_CHAOS_END_S) return 'Endgame';
  return 'Chaos';
}

/** Hit, Dash, Jump — degrees from +X axis (CCW); center is bottom-right of arc box. */
/** All three circles fit inside this width (no overflow past `right:` edge). */
const ACTION_ARC_W = 220;
const ACTION_ARC_H = 120;
/** Larger radius = more space between the three circles. */
const ACTION_ARC_R = 72;
/** Arc center — tuned so Jump’s right edge stays inside ACTION_ARC_W. */
const ACTION_ARC_CENTER_X = 132;
const ACTION_ARC_CENTER_Y = ACTION_ARC_H - 10;
/** ~half-circle fan; degrees spaced a touch wider than before (Hit → Dash → Jump). */
const ACTION_ARC_ANGLES_HIT_DASH_JUMP = [156, 93, 32] as const;

function actionArcButtonPositions(): { left: number; top: number }[] {
  const half = ACTION_CIRCLE_SIZE / 2;
  const r = ACTION_ARC_R;
  return ACTION_ARC_ANGLES_HIT_DASH_JUMP.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
      left: ACTION_ARC_CENTER_X + r * Math.cos(rad) - half,
      top: ACTION_ARC_CENTER_Y - r * Math.sin(rad) - half,
    };
  });
}

const ACTION_ARC_LAYOUT = actionArcButtonPositions();
/**
 * Eat into the right safe-area inset (px) so the arc sits closer to the bezel.
 * Clamped to ≥ 0 so we never offset past the screen.
 */
const ACTION_CONTROLS_SAFE_RIGHT_NUDGE_PX = 44;
/** Extra px after `(insets.right - nudge)` — usually 0. */
const ACTION_CONTROLS_RIGHT_GUTTER = 26;
/** Move the whole action arc upward (px). */
const ACTION_CONTROLS_BOTTOM_GUTTER = 14;

function overlapX(
  ax: number,
  aw: number,
  p: Pick<PlatformWorld, 'x' | 'w'>,
  inset = 4,
): boolean {
  return ax + aw > p.x + inset && ax < p.x + p.w - inset;
}

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Visual slabs aligned 1:1 with physics hitboxes from `buildArenaPlatforms`. */
function ArenaPlatformArt({
  platforms,
  worldW,
  worldH,
  styles,
}: {
  platforms: PlatformWorld[];
  worldW: number;
  worldH: number;
  styles: { platformArtClip: object; platformArtImage: object };
}) {
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
        >
          {/*  <Image
            source={ARENA_MAP_BG}
            style={styles.platformArtImage}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
          /> */}
        </View>
      ))}
    </>
  );
}

export default function BrawlerArenaScreen({ navigation, route }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { heroId, heroStats: heroStatsParam } = route.params;
  const insets = useSafeAreaInsets();

  const soloOptions = route.params?.soloOptions;
  const soloDifficulty = soloOptions?.difficulty ?? 'normal';
  const difficultyTuning = useMemo(() => {
    if (soloDifficulty === 'easy') return { enemySpeedMul: 0.85, contactDmg: 7 };
    if (soloDifficulty === 'hard') return { enemySpeedMul: 1.25, contactDmg: 14 };
    return { enemySpeedMul: 1.0, contactDmg: 10 };
  }, [soloDifficulty]);

  // Dev settings (in-game toggles to speed up iteration)
  const [devOpen, setDevOpen] = useState(false);
  const [devMatchTimerEnabled, setDevMatchTimerEnabled] = useState(
    DEFAULT_MATCH_TIMER_ENABLED,
  );
  const [devEnemiesEnabled, setDevEnemiesEnabled] = useState(
    soloOptions ? (soloOptions.opponentCount > 0) : true,
  );
  const [devEnemyCount, setDevEnemyCount] = useState(
    soloOptions ? Math.max(0, Math.min(6, Math.floor(soloOptions.opponentCount))) : 1,
  );
  const [devDummiesEnabled, setDevDummiesEnabled] = useState(true);
  const [devDummyCount, setDevDummyCount] = useState(3);
  const [devShowAttackHitbox, setDevShowAttackHitbox] = useState(
    DEFAULT_SHOW_ATTACK_HITBOX_DEBUG,
  );

  const [arenaBox, setArenaBox] = useState({ w: 0, h: 0 });
  const arenaW = arenaBox.w || 1;
  const arenaInnerH = arenaBox.h || 1;
  const worldW = Math.max(arenaW, Math.round(arenaW * 2.4));
  const worldH = Math.max(arenaInnerH, Math.round(arenaInnerH * 1.35));

  const heroCombat = useMemo(
    () => arenaHeroCombat(heroStatsParam),
    [
      heroStatsParam?.baseHp,
      heroStatsParam?.moveSpeed,
      heroStatsParam?.dashCooldownMs,
      heroStatsParam?.attackDamage,
      heroStatsParam?.attackKnockback,
    ],
  );

  const playerX = useRef(0);
  const playerY = useRef(0);
  const dummiesRef = useRef<Dummy[]>([]);
  const nextDummyIdRef = useRef(1);

  const hitAppliedThisSwing = useRef(false);

  const heroHpRef = useRef(heroCombat.baseHp);
  const heroIFramesLeftRef = useRef(0);
  const [heroDeadOpen, setHeroDeadOpen] = useState(false);

  const enemiesRef = useRef<Enemy[]>([]);

  type DmgFloat = {
    id: number;
    x: number;
    y: number;
    text: string;
    age: number; // seconds
  };

  const dmgFloatsRef = useRef<DmgFloat[]>([]);
  const dmgFloatIdRef = useRef(1);

  const bodyW = BRUISER_FRAME_PX.w * SPRITE_SCALE;
  const bodyH = BRUISER_FRAME_PX.h * SPRITE_SCALE;

  const FEET_W = bodyW * 0.22;

  const floorY = useMemo(
    () => Math.max(0, worldH - GROUND_STRIP_H - bodyH - 4),
    [worldH, bodyH],
  );

  const platformsWorld = useMemo(
    () => buildArenaPlatforms(worldW, worldH, GROUND_STRIP_H, 4),
    [worldW, worldH],
  );


  const prevPlayerY = useRef(0);
  const vx = useRef(0);
  const vy = useRef(0);
  const onGround = useRef(true);
  const facing = useRef<'left' | 'right'>('right');
  const joyRef = useRef({ x: 0, y: 0 });
  const jumpQueued = useRef(false);
  const hitQueued = useRef(false);
  const dashQueued = useRef(false);

  const attackTimeLeft = useRef(0);
  const dashTimeLeft = useRef(0);
  const dashCooldownLeft = useRef(0);
  const hitFrameRef = useRef(0);
  const dashHitAppliedRef = useRef(false);

  const [, setRenderTick] = useState(0);
  const spriteAnimRef = useRef<BruiserSpriteAnim>('idle');
  const walkFrameRef = useRef(0);
  const walkAccum = useRef(0);
  const lastSpawnKey = useRef({
    w: 0,
    h: 0,
    embedG: -9999,
    embedF: -9999,
  });

  const preMatchLeftRef = useRef(
    DEFAULT_MATCH_TIMER_ENABLED ? PRE_MATCH_COUNTDOWN_S : 0,
  );
  const matchClockRef = useRef(0);
  const matchEndedRef = useRef(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);

  const bump = useCallback(() => {
    setRenderTick((t) => (t + 1) % 1_000_000);
  }, []);

  const spawnDummiesRandomOnPlatforms = useCallback(
    (count: number, heroSpawn: { x: number; y: number }) => {
      const plats = buildArenaPlatforms(worldW, worldH, GROUND_STRIP_H, 4);
      const validPlats = plats.filter((p) => p.w >= DUMMY_W + 2);
      const next: Dummy[] = [];

      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

      const overlapsExisting = (x: number, y: number) =>
        next.some((d) => aabbOverlap(x, y, DUMMY_W, DUMMY_H, d.x, d.y, d.w, d.h));

      for (let i = 0; i < count; i++) {
        let placed = false;
        for (let attempt = 0; attempt < 24; attempt++) {
          const p = validPlats[Math.floor(Math.random() * validPlats.length)];
          if (!p) break;
          const xMin = clamp(p.x, MARGIN_SCREEN, worldW - MARGIN_SCREEN - DUMMY_W);
          const xMax = clamp(p.x + p.w - DUMMY_W, MARGIN_SCREEN, worldW - MARGIN_SCREEN - DUMMY_W);
          if (xMax <= xMin) continue;
          const x = rand(xMin, xMax);
          const y = clamp(p.y - DUMMY_H, 0, worldH - DUMMY_H);
          if (overlapsExisting(x, y)) continue;

          next.push({
            id: nextDummyIdRef.current++,
            x,
            y,
            w: DUMMY_W,
            h: DUMMY_H,
            vy: 0,
            prevY: y,
            onGround: true,
            hp: DUMMY_HP_MAX,
            respawnLeft: 0,
            flashLeft: 0,
            knockVx: 0,
          });
          placed = true;
          break;
        }

        if (!placed) {
          // Fallback: place near hero spawn.
          const x = clamp(
            heroSpawn.x + bodyW + 24 + i * (DUMMY_W + 18),
            MARGIN_SCREEN,
            worldW - MARGIN_SCREEN - DUMMY_W,
          );
          const y = clamp(heroSpawn.y + bodyH - DUMMY_H, 0, worldH - DUMMY_H);
          next.push({
            id: nextDummyIdRef.current++,
            x,
            y,
            w: DUMMY_W,
            h: DUMMY_H,
            vy: 0,
            prevY: y,
            onGround: true,
            hp: DUMMY_HP_MAX,
            respawnLeft: 0,
            flashLeft: 0,
            knockVx: 0,
          });
        }
      }

      dummiesRef.current = next;
    },
    [worldW, worldH, bodyW, bodyH],
  );

  const spawnEnemyOnRandomPlatform = useCallback((): Enemy => {
    const plats = buildArenaPlatforms(worldW, worldH, GROUND_STRIP_H, 4);
    const valid: { p: PlatformWorld; idx: number }[] = [];
    for (let i = 0; i < plats.length; i++) {
      const p = plats[i]!;
      if (p.w >= ENEMY_W + 2) valid.push({ p, idx: i });
    }
    const pick = valid.length
      ? valid[Math.floor(Math.random() * valid.length)]!
      : { p: plats[plats.length - 1]!, idx: Math.max(0, plats.length - 1) };

    const xMin = Math.max(MARGIN_SCREEN, pick.p.x);
    const xMax = Math.min(worldW - MARGIN_SCREEN - ENEMY_W, pick.p.x + pick.p.w - ENEMY_W);
    const x = xMax > xMin ? xMin + Math.random() * (xMax - xMin) : xMin;
    const y = Math.max(0, Math.min(worldH - ENEMY_H, pick.p.y - ENEMY_H));
    const dir = Math.random() < 0.5 ? -1 : 1;

    return {
      x,
      y,
      w: ENEMY_W,
      h: ENEMY_H,
      vx: dir * ENEMY_SPEED * difficultyTuning.enemySpeedMul,
      vy: 0,
      prevY: y,
      onGround: true,
      hp: ENEMY_HP_MAX,
      iFramesLeft: 0,
      respawnLeft: 0,
      flashLeft: 0,
      knockVx: 0,
      platformIndex: pick.idx,
    };
  }, [worldW, worldH, difficultyTuning.enemySpeedMul]);

  const syncEnemyCount = useCallback(
    (count: number) => {
      const n = Math.max(0, Math.min(6, Math.floor(count)));
      const next: Enemy[] = [];
      for (let i = 0; i < n; i++) next.push(spawnEnemyOnRandomPlatform());
      enemiesRef.current = next;
    },
    [spawnEnemyOnRandomPlatform],
  );

  useEffect(() => {
    if (arenaW < 32 || arenaInnerH < 32) return;
    const eg = HERO_FEET_EMBED_GROUND_PLATFORM_PX;
    const ef = HERO_FEET_EMBED_FLOATING_PLATFORM_PX;
    if (
      lastSpawnKey.current.w === worldW &&
      lastSpawnKey.current.h === worldH &&
      lastSpawnKey.current.embedG === eg &&
      lastSpawnKey.current.embedF === ef
    ) {
      return;
    }
    lastSpawnKey.current = {
      w: worldW,
      h: worldH,
      embedG: eg,
      embedF: ef,
    };
    const spawn = spawnOnBottomPlatform(
      worldW,
      worldH,
      bodyW,
      bodyH,
      MARGIN_SCREEN,
      GROUND_STRIP_H,
      4,
    );
    playerX.current = spawn.x;
    playerY.current = spawn.y;
    prevPlayerY.current = spawn.y;

    if (devDummiesEnabled) spawnDummiesRandomOnPlatforms(devDummyCount, spawn);
    else dummiesRef.current = [];

    if (devEnemiesEnabled) syncEnemyCount(devEnemyCount);
    else enemiesRef.current = [];

    heroHpRef.current = heroCombat.baseHp;
    heroIFramesLeftRef.current = 0;
    setHeroDeadOpen(false);

    hitAppliedThisSwing.current = false;
    bump();
  }, [
    arenaW,
    arenaInnerH,
    worldW,
    worldH,
    bodyW,
    bodyH,
    heroCombat.baseHp,
    HERO_FEET_EMBED_GROUND_PLATFORM_PX,
    HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
    spawnDummiesRandomOnPlatforms,
    syncEnemyCount,
    devDummiesEnabled,
    devDummyCount,
    devEnemiesEnabled,
    devEnemyCount,
  ]);

  useEffect(() => {
    if (heroId !== BRUISER_ARENA_HERO_ID) {
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
    }
  }, [heroId, navigation, route.params.venueId]);

  const onArenaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArenaBox({ w: width, h: height });
  }, []);

  const platformsRef = useRef(platformsWorld);
  platformsRef.current = platformsWorld;

  const resetArenaRound = useCallback(() => {
    if (arenaW < 32 || arenaInnerH < 32) return;
    const spawn = spawnOnBottomPlatform(
      worldW,
      worldH,
      bodyW,
      bodyH,
      MARGIN_SCREEN,
      GROUND_STRIP_H,
      4,
    );
    playerX.current = spawn.x;
    playerY.current = spawn.y;
    prevPlayerY.current = spawn.y;
    if (devDummiesEnabled) spawnDummiesRandomOnPlatforms(devDummyCount, spawn);
    else dummiesRef.current = [];

    if (devEnemiesEnabled) syncEnemyCount(devEnemyCount);
    else enemiesRef.current = [];
    heroHpRef.current = heroCombat.baseHp;
    heroIFramesLeftRef.current = 0;
    setHeroDeadOpen(false);

    vx.current = 0;
    vy.current = 0;
    onGround.current = true;
    facing.current = 'right';
    joyRef.current.x = 0;
    joyRef.current.y = 0;
    jumpQueued.current = false;
    hitQueued.current = false;
    dashQueued.current = false;
    attackTimeLeft.current = 0;
    dashTimeLeft.current = 0;
    dashCooldownLeft.current = 0;
    hitFrameRef.current = 0;
    spriteAnimRef.current = 'idle';
    walkFrameRef.current = 0;
    walkAccum.current = 0;
    matchEndedRef.current = false;
    matchClockRef.current = 0;
    preMatchLeftRef.current = devMatchTimerEnabled ? PRE_MATCH_COUNTDOWN_S : 0;
    setGameOverOpen(false);
    bump();
  }, [
    arenaW,
    arenaInnerH,
    worldW,
    worldH,
    bodyW,
    bodyH,
    heroCombat.baseHp,
    bump,
    spawnDummiesRandomOnPlatforms,
    syncEnemyCount,
    devDummiesEnabled,
    devDummyCount,
    devEnemiesEnabled,
    devEnemyCount,
    devMatchTimerEnabled,
  ]);

  useEffect(() => {
    if (arenaInnerH <= 0) return;
    const rafRef = { current: 0 };
    let cancelled = false;
    let last =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    const step = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const arenaReady = arenaW >= 32 && arenaInnerH >= 32;

      if (
        arenaReady &&
        devMatchTimerEnabled &&
        preMatchLeftRef.current > 0
      ) {
        const t0 = preMatchLeftRef.current;
        preMatchLeftRef.current = Math.max(0, t0 - dt);
        const ceilBefore = t0 > 0 ? Math.max(1, Math.ceil(t0)) : 0;
        const ceilAfter =
          preMatchLeftRef.current > 0
            ? Math.max(1, Math.ceil(preMatchLeftRef.current))
            : 0;
        if (
          ceilBefore !== ceilAfter ||
          (preMatchLeftRef.current <= 0 && t0 > 0)
        ) {
          bump();
        }
        joyRef.current.x = 0;
        joyRef.current.y = 0;
        jumpQueued.current = false;
        hitQueued.current = false;
        dashQueued.current = false;
        vx.current = 0;
        vy.current = 0;
        attackTimeLeft.current = 0;
        dashTimeLeft.current = 0;
        dashCooldownLeft.current = 0;
        hitFrameRef.current = 0;
        spriteAnimRef.current = 'idle';
        walkAccum.current = 0;
        prevPlayerY.current = playerY.current;
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      if (
        arenaReady &&
        devMatchTimerEnabled &&
        preMatchLeftRef.current <= 0
      ) {
        if (!matchEndedRef.current) {
          matchClockRef.current = Math.min(
            MATCH_MAX_S,
            matchClockRef.current + dt,
          );
          if (matchClockRef.current >= MATCH_MAX_S) {
            matchEndedRef.current = true;
            setGameOverOpen(true);
          }
        }
      }

      if (
        arenaReady &&
        devMatchTimerEnabled &&
        preMatchLeftRef.current <= 0 &&
        matchEndedRef.current
      ) {
        joyRef.current.x = 0;
        joyRef.current.y = 0;
        jumpQueued.current = false;
        hitQueued.current = false;
        dashQueued.current = false;
        vx.current = 0;
        vy.current = 0;
        attackTimeLeft.current = 0;
        dashTimeLeft.current = 0;
        dashCooldownLeft.current = 0;
        hitFrameRef.current = 0;
        spriteAnimRef.current = 'idle';
        walkAccum.current = 0;
        prevPlayerY.current = playerY.current;
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      // Hero death: freeze inputs and physics while overlay is open.
      if (heroDeadOpen) {
        joyRef.current.x = 0;
        joyRef.current.y = 0;
        jumpQueued.current = false;
        hitQueued.current = false;
        dashQueued.current = false;
        vx.current = 0;
        vy.current = 0;
        attackTimeLeft.current = 0;
        dashTimeLeft.current = 0;
        dashCooldownLeft.current = 0;
        hitFrameRef.current = 0;
        spriteAnimRef.current = 'idle';
        walkAccum.current = 0;
        prevPlayerY.current = playerY.current;
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const plats = platformsRef.current;
      const prevY = prevPlayerY.current;

      dashCooldownLeft.current = Math.max(0, dashCooldownLeft.current - dt);

      const wasDashing = dashTimeLeft.current > 0;
      dashTimeLeft.current = Math.max(0, dashTimeLeft.current - dt);
      if (wasDashing && dashTimeLeft.current <= 0) {
        dashCooldownLeft.current = heroCombat.dashCooldownS;
      }

      attackTimeLeft.current = Math.max(0, attackTimeLeft.current - dt);

      // Dummies: respawn / flash / knockback (runs every frame)
      let dummiesChanged = false;
      for (const d of dummiesRef.current) {
        if (d.respawnLeft > 0) {
          d.respawnLeft = Math.max(0, d.respawnLeft - dt);
          if (d.respawnLeft <= 0) {
            // Respawn on a valid platform.
            const platsNow = plats;
            const valid = platsNow.filter((p) => p.w >= d.w + 2);
            const p = valid.length
              ? valid[Math.floor(Math.random() * valid.length)]!
              : platsNow[platsNow.length - 1]!;
            const xMin = Math.max(MARGIN_SCREEN, p.x);
            const xMax = Math.min(worldW - MARGIN_SCREEN - d.w, p.x + p.w - d.w);
            d.x = xMax > xMin ? xMin + Math.random() * (xMax - xMin) : xMin;
            d.y = Math.max(0, Math.min(worldH - d.h, p.y - d.h));
            d.prevY = d.y;
            d.vy = 0;
            d.onGround = true;
            d.hp = DUMMY_HP_MAX;
            dummiesChanged = true;
          }
        }

        if (d.flashLeft > 0) {
          d.flashLeft = Math.max(0, d.flashLeft - dt);
        }

        if (d.knockVx !== 0) {
          d.knockVx *= Math.pow(0.25, dt * 10);
          if (Math.abs(d.knockVx) < 2) d.knockVx = 0;

          d.x += d.knockVx * dt;
          d.x = Math.max(MARGIN_SCREEN, Math.min(worldW - MARGIN_SCREEN - d.w, d.x));
          dummiesChanged = true;
        }

        // Gravity + platform landing (so knockback can push off ledges).
        if (d.hp > 0 && d.respawnLeft <= 0) {
          d.prevY = d.y;
          d.vy += GRAVITY * dt;
          d.y += d.vy * dt;

          const prevBottom = d.prevY + d.h;
          const newBottom = d.y + d.h;
          if (d.vy > 0) {
            let best: PlatformWorld | null = null;
            for (const p of plats) {
              if (!overlapX(d.x, d.w, p, 0)) continue;
              const pt = p.y;
              if (prevBottom <= pt + 14 && newBottom >= pt - 6) {
                if (!best || pt < best.y) best = p;
              }
            }
            if (best) {
              d.y = best.y - d.h;
              d.vy = 0;
              d.onGround = true;
              dummiesChanged = true;
            } else {
              d.onGround = false;
            }
          }

          // Fell out of view: respawn somewhere sane.
          if (d.y > worldH + 120) {
            d.respawnLeft = 0.15;
            d.hp = 0;
            dummiesChanged = true;
          }
        }
      }
      if (dummiesChanged) bump();

      // Floating damage numbers tick
      const floats = dmgFloatsRef.current;
      if (floats.length > 0) {
        for (const f of floats) f.age += dt;
        dmgFloatsRef.current = floats.filter((f) => f.age < DMG_FLOAT_LIFETIME_S);
        bump();
      }

      // Hero invulnerability frames (contact damage cooldown).
      heroIFramesLeftRef.current = Math.max(0, heroIFramesLeftRef.current - dt);

      // Enemy state tick (respawn / i-frames / patrol).
      {
        const enemies = enemiesRef.current;
        if (enemies.length > 0) {
          let changed = false;
          for (let ei = 0; ei < enemies.length; ei++) {
            const e = enemies[ei]!;

            if (e.respawnLeft > 0) {
              e.respawnLeft = Math.max(0, e.respawnLeft - dt);
              if (e.respawnLeft <= 0) {
                enemies[ei] = spawnEnemyOnRandomPlatform();
                changed = true;
                continue;
              }
            }

            e.iFramesLeft = Math.max(0, e.iFramesLeft - dt);
            e.flashLeft = Math.max(0, e.flashLeft - dt);

            if (e.knockVx !== 0) {
              e.knockVx *= Math.pow(0.25, dt * 10);
              if (Math.abs(e.knockVx) < 2) e.knockVx = 0;
            }

            const alive = e.hp > 0 && e.respawnLeft <= 0;
            if (alive) {
              const p = plats[e.platformIndex] ?? plats[plats.length - 1]!;
              const xMin = Math.max(MARGIN_SCREEN, p.x);
              const xMax = Math.min(
                worldW - MARGIN_SCREEN - e.w,
                p.x + p.w - e.w,
              );
              const y = Math.max(0, Math.min(worldH - e.h, p.y - e.h));

              // Horizontal: patrol clamps/reverses only when not being knocked.
              const knocked = Math.abs(e.knockVx) > 1;
              if (!knocked && e.onGround) {
                e.x += e.vx * dt;
                if (e.x <= xMin) {
                  e.x = xMin;
                  e.vx = Math.abs(e.vx);
                } else if (e.x >= xMax) {
                  e.x = xMax;
                  e.vx = -Math.abs(e.vx);
                }
              } else {
                // Knockback can push it off the platform edge.
                e.x += (e.vx + e.knockVx) * dt;
              }

              // Gravity + landing (enemy falls if pushed off).
              e.prevY = e.y;
              e.vy += GRAVITY * dt;
              e.y += e.vy * dt;

              const prevBottom = e.prevY + e.h;
              const newBottom = e.y + e.h;
              if (e.vy > 0) {
                let best: { p: PlatformWorld; idx: number } | null = null;
                for (let i = 0; i < plats.length; i++) {
                  const pl = plats[i]!;
                  if (!overlapX(e.x, e.w, pl, 0)) continue;
                  const pt = pl.y;
                  if (prevBottom <= pt + 14 && newBottom >= pt - 6) {
                    if (!best || pt < best.p.y) best = { p: pl, idx: i };
                  }
                }
                if (best) {
                  e.y = best.p.y - e.h;
                  e.vy = 0;
                  e.onGround = true;
                  e.platformIndex = best.idx;
                } else {
                  e.onGround = false;
                }
              }

              // Keep y aligned to platform top when onGround and not falling (stability).
              if (e.onGround && e.vy === 0 && !knocked) {
                e.y = y;
              }

              // Fell out of view: respawn on a platform (keep HP).
              if (e.y > worldH + 160) {
                const hpKeep = e.hp;
                enemies[ei] = spawnEnemyOnRandomPlatform();
                enemies[ei]!.hp = hpKeep;
                enemies[ei]!.iFramesLeft = Math.max(enemies[ei]!.iFramesLeft, 0.2);
                changed = true;
              }
            }
          }
          if (changed) {
            enemiesRef.current = enemies;
            bump();
          }
        }
      }

      if (
        hitQueued.current &&
        attackTimeLeft.current <= 0 &&
        dashTimeLeft.current <= 0
      ) {
        hitQueued.current = false;
        attackTimeLeft.current = ATTACK_DURATION_S;
        hitFrameRef.current = 0;
        hitAppliedThisSwing.current = false;
      }

      if (
        dashQueued.current &&
        dashCooldownLeft.current <= 0 &&
        attackTimeLeft.current <= 0 &&
        dashTimeLeft.current <= 0
      ) {
        dashQueued.current = false;
        const jx = joyRef.current.x;
        if (Math.abs(jx) > 0.06) {
          facing.current = jx < 0 ? 'left' : 'right';
        }
        dashTimeLeft.current = DASH_DURATION_S;
        dashHitAppliedRef.current = false;
      }

      if (attackTimeLeft.current <= 0) {
        hitFrameRef.current = 0;
      }

      const dashing = dashTimeLeft.current > 0;
      const attacking = attackTimeLeft.current > 0;

      // Dash damage: one hit per dash, enemy first, then dummies.
      if (dashing && !dashHitAppliedRef.current) {
        const dashW = bodyW * 0.9;
        const dashH = bodyH * 0.7;
        const dashY = playerY.current + bodyH * 0.15;
        const dashX =
          facing.current === 'right'
            ? playerX.current + bodyW * 0.55
            : playerX.current - dashW + bodyW * 0.45;

        const dir = facing.current === 'right' ? 1 : -1;
        const enemies = enemiesRef.current;
        const hitEnemy = enemies.find(
          (e) =>
            e.hp > 0 &&
            e.respawnLeft <= 0 &&
            e.iFramesLeft <= 0 &&
            aabbOverlap(dashX, dashY, dashW, dashH, e.x, e.y, e.w, e.h),
        );

        if (hitEnemy) {
          hitEnemy.hp = Math.max(0, hitEnemy.hp - heroCombat.dashDmg);
          hitEnemy.iFramesLeft = ENEMY_IFRAMES_S;
          hitEnemy.flashLeft = 0.12;
          hitEnemy.knockVx = dir * heroCombat.dashKnockbackSpeed;
          hitEnemy.x = Math.max(
            MARGIN_SCREEN,
            Math.min(
              worldW - MARGIN_SCREEN - hitEnemy.w,
              hitEnemy.x + dir * heroCombat.dashShovePx,
            ),
          );
          if (hitEnemy.hp <= 0) hitEnemy.respawnLeft = ENEMY_RESPAWN_DELAY_S;

          dmgFloatsRef.current.push({
            id: dmgFloatIdRef.current++,
            x: hitEnemy.x + hitEnemy.w / 2,
            y: hitEnemy.y,
            text: `-${heroCombat.dashDmg}`,
            age: 0,
          });

          dashHitAppliedRef.current = true;
          bump();
        } else {
          const hitDummy = dummiesRef.current.find(
            (d) => d.hp > 0 && aabbOverlap(dashX, dashY, dashW, dashH, d.x, d.y, d.w, d.h),
          );
          if (hitDummy) {
            hitDummy.hp = Math.max(0, hitDummy.hp - heroCombat.dashDmg);
            hitDummy.flashLeft = 0.12;
            hitDummy.knockVx = dir * heroCombat.dashKnockbackSpeed;
            hitDummy.x = Math.max(
              MARGIN_SCREEN,
              Math.min(
                worldW - MARGIN_SCREEN - hitDummy.w,
                hitDummy.x + dir * heroCombat.dashShovePx,
              ),
            );
            if (hitDummy.hp <= 0) hitDummy.respawnLeft = DUMMY_RESPAWN_DELAY_S;

            dmgFloatsRef.current.push({
              id: dmgFloatIdRef.current++,
              x: hitDummy.x + hitDummy.w / 2,
              y: hitDummy.y,
              text: `-${heroCombat.dashDmg}`,
              age: 0,
            });

            dashHitAppliedRef.current = true;
            bump();
          }
        }
      }


      if (attacking) {
        // Only allow 1 damage application per swing.
        if (!hitAppliedThisSwing.current) {
          const hitW = ATTACK_HIT_W;
          const hitH = ATTACK_HIT_H;

          const hitY = playerY.current + ATTACK_HIT_Y_FROM_TOP;
          const hitX =
            facing.current === 'right'
              ? playerX.current + bodyW + ATTACK_HIT_FORWARD
              : playerX.current - hitW - ATTACK_HIT_FORWARD;

          const dmg = heroCombat.attackDamage;

          // Priority: hit enemy first if overlapping, else hit a dummy.
          const dir = facing.current === 'right' ? 1 : -1;
          const enemies = enemiesRef.current;
          const hitEnemy = enemies.find(
            (e) =>
              e.hp > 0 &&
              e.respawnLeft <= 0 &&
              e.iFramesLeft <= 0 &&
              aabbOverlap(hitX, hitY, hitW, hitH, e.x, e.y, e.w, e.h),
          );

          if (hitEnemy) {
            hitEnemy.hp = Math.max(0, hitEnemy.hp - dmg);
            hitEnemy.iFramesLeft = ENEMY_IFRAMES_S;
            hitEnemy.flashLeft = 0.12;
            hitEnemy.knockVx = dir * 520;

            dmgFloatsRef.current.push({
              id: dmgFloatIdRef.current++,
              x: hitEnemy.x + hitEnemy.w / 2,
              y: hitEnemy.y,
              text: `-${dmg}`,
              age: 0,
            });

            if (hitEnemy.hp <= 0) {
              hitEnemy.respawnLeft = ENEMY_RESPAWN_DELAY_S;
            }

            hitAppliedThisSwing.current = true;
            bump();
          } else {
            const hitAny = dummiesRef.current.find(
              (d) =>
                d.hp > 0 &&
                aabbOverlap(hitX, hitY, hitW, hitH, d.x, d.y, d.w, d.h),
            );

            if (hitAny) {
              hitAny.hp = Math.max(0, hitAny.hp - dmg);

              dmgFloatsRef.current.push({
                id: dmgFloatIdRef.current++,
                x: hitAny.x + hitAny.w / 2,
                y: hitAny.y,
                text: `-${dmg}`,
                age: 0,
              });

              if (hitAny.hp <= 0) {
                hitAny.respawnLeft = DUMMY_RESPAWN_DELAY_S;
              }

              hitAppliedThisSwing.current = true;
              hitAny.flashLeft = 0.12;
              const dir = facing.current === 'right' ? 1 : -1;
              hitAny.knockVx = dir * 420;
              bump(); // force re-render to show HP drop
            }
          }
        }
      }

      if (dashing) {
        const dir = facing.current === 'right' ? 1 : -1;
        vx.current = dir * DASH_SPEED;
      } else if (!attacking) {
        const jx = joyRef.current.x;
        if (Math.abs(jx) > 0.02) {
          vx.current = jx * heroCombat.moveSpeedPx;
          facing.current = jx < 0 ? 'left' : 'right';
        } else {
          vx.current *= Math.pow(0.2, dt * 10);
          if (Math.abs(vx.current) < 4) vx.current = 0;
        }
      } else {
        vx.current *= Math.pow(0.15, dt * 10);
        if (Math.abs(vx.current) < 8) vx.current = 0;
      }

      playerX.current += vx.current * dt;
      const minX = MARGIN_SCREEN;
      const maxX = worldW - MARGIN_SCREEN - bodyW;
      playerX.current = Math.max(minX, Math.min(maxX, playerX.current));

      // Strict platformer: support checks use a narrow "feet" probe, not full body width.
      const feetX = playerX.current + (bodyW - FEET_W) / 2;

      if (jumpQueued.current && onGround.current && !attacking) {
        vy.current = JUMP_VELOCITY;
        onGround.current = false;
        jumpQueued.current = false;
      }

      vy.current += GRAVITY * dt;
      playerY.current += vy.current * dt;

      const prevBottom = prevY + bodyH;
      let newBottom = playerY.current + bodyH;

      // No head-bonk on platform bottoms: jump up passes through the slab so you can
      // land on top from below (classic pass-through / one-way behavior).

      if (vy.current > 0) {
        let best: PlatformWorld | null = null;
        for (const p of plats) {
          if (!overlapX(feetX, FEET_W, p)) continue;
          const pt = p.y;
          if (prevBottom <= pt + 14 && newBottom >= pt - 6) {
            if (!best || pt < best.y) best = p;
          }
        }
        if (best) {
          const e = best.feetEmbedPx;
          playerY.current = best.y - bodyH + e;
          vy.current = 0;
          onGround.current = true;
          newBottom = best.y + e;
        }
      }

      // Only when not rising: avoids “sticking” to a lower platform while jumping up
      // through it toward a higher one (vy >= -40 would snag at jump apex).
      if (vy.current >= 0) {
        newBottom = playerY.current + bodyH;
        for (const p of plats) {
          if (!overlapX(feetX, FEET_W, p)) continue;
          const pt = p.y;
          if (newBottom >= pt - 2 && newBottom <= pt + 18) {
            const e = p.feetEmbedPx;
            playerY.current = pt - bodyH + e;
            vy.current = 0;
            onGround.current = true;
            newBottom = pt + e;
            break;
          }
        }
      }

      const bot = plats[plats.length - 1]!;
      const horizOnBottom = overlapX(feetX, FEET_W, bot, 0);

      const floorClampY = floorY + HERO_FEET_EMBED_GROUND_PLATFORM_PX;
      // Only snap to the “floor” when still under the bottom slab in X; in side gaps
      // there is no invisible ground — you fall until respawn below the arena.
      if (playerY.current >= floorClampY) {
        if (horizOnBottom) {
          playerY.current = floorClampY;
          vy.current = 0;
          onGround.current = true;
        } else {
          onGround.current = false;
        }
      } else {
        let supported = false;
        const feet = playerY.current + bodyH;
        for (const p of plats) {
          if (!overlapX(feetX, FEET_W, p)) continue;
          if (
            Math.abs(feet - p.y - p.feetEmbedPx) < 10 &&
            vy.current >= -20
          ) {
            supported = true;
            break;
          }
        }
        onGround.current = supported;
      }

      // Enemy contact damage (strict contact collider: inset rectangles).
      if (heroHpRef.current > 0 && heroIFramesLeftRef.current <= 0) {
        const enemies = enemiesRef.current;
        if (enemies.length > 0) {
          // Tighten both colliders so being on a nearby platform doesn't count as contact.
          const heroInsetX = bodyW * 0.22;
          const heroInsetTop = bodyH * 0.18;
          const heroInsetBottom = bodyH * 0.08;
          const hx = playerX.current + heroInsetX;
          const hy = playerY.current + heroInsetTop;
          const hw = Math.max(1, bodyW - heroInsetX * 2);
          const hh = Math.max(1, bodyH - heroInsetTop - heroInsetBottom);

          const enemyInset = 6;
          const touchingEnemy = enemies.find((e) => {
            if (e.hp <= 0 || e.respawnLeft > 0) return false;
            const ex = e.x + enemyInset;
            const ey = e.y + enemyInset;
            const ew = Math.max(1, e.w - enemyInset * 2);
            const eh = Math.max(1, e.h - enemyInset * 2);
            return aabbOverlap(hx, hy, hw, hh, ex, ey, ew, eh);
          });

          if (touchingEnemy) {
            heroHpRef.current = Math.max(0, heroHpRef.current - difficultyTuning.contactDmg);
            heroIFramesLeftRef.current = HERO_IFRAMES_S;
            // Light knockback away from enemy to make hits readable.
            const dir =
              playerX.current + bodyW / 2 < touchingEnemy.x + touchingEnemy.w / 2 ? -1 : 1;
            vx.current = dir * 220;
            if (heroHpRef.current <= 0) {
              setHeroDeadOpen(true);
            }
            bump();
          }
        }
      }

      // Fell through a bottom-deck gap — respawn only after dropping past the view.
      const feetBottom = playerY.current + bodyH;
      if (feetBottom > worldH + 36) {
        const spawn = spawnOnBottomPlatform(
          worldW,
          worldH,
          bodyW,
          bodyH,
          MARGIN_SCREEN,
          GROUND_STRIP_H,
          4,
        );
        playerX.current = spawn.x;
        playerY.current = spawn.y;
        prevPlayerY.current = spawn.y;
        vx.current = 0;
        vy.current = 0;
        onGround.current = true;
      }

      prevPlayerY.current = playerY.current;

      let nextAnim: BruiserSpriteAnim = 'idle';
      if (attacking) nextAnim = 'hit';
      else if (dashing) nextAnim = 'dash';
      else if (!onGround.current) nextAnim = 'jump';
      else if (Math.abs(vx.current) > 20) nextAnim = 'walk';
      spriteAnimRef.current = nextAnim;

      if (nextAnim === 'walk') {
        walkAccum.current += dt * 1000;
        if (walkAccum.current >= WALK_FRAME_MS) {
          walkAccum.current %= WALK_FRAME_MS;
          walkFrameRef.current =
            (walkFrameRef.current + 1) % BRUISER_ANIM.walkRight.frameCount;
        }
      } else {
        walkAccum.current = 0;
      }

      bump();
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [
    arenaW,
    arenaInnerH,
    worldW,
    worldH,
    bump,
    bodyW,
    bodyH,
    floorY,
    heroCombat,
    heroDeadOpen,
    HERO_FEET_EMBED_GROUND_PLATFORM_PX,
    HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
  ]);

  const px = Math.round(playerX.current);
  const py = Math.round(playerY.current);
  const camX = Math.max(
    0,
    Math.min(worldW - arenaW, px + bodyW / 2 - arenaW / 2),
  );
  const camY = Math.max(
    0,
    Math.min(worldH - arenaInnerH, py + bodyH / 2 - arenaInnerH / 2),
  );
  const attackingNow = spriteAnimRef.current === 'hit';
  const hitFineSheetPx = attackingNow
    ? BRUISER_HIT_FINE_OFFSET_SHEET_PX[facing.current]
    : 0;
  const hitDrawOffsetX =
    (BRUISER_HIT_ANCHOR_OFFSET_X + hitFineSheetPx) * SPRITE_SCALE;

  const dashReady = dashCooldownLeft.current <= 0 && dashTimeLeft.current <= 0;

  const arenaReadyHud = arenaW >= 32 && arenaInnerH >= 32;
  const controlsLive = devMatchTimerEnabled
    ? arenaReadyHud &&
      preMatchLeftRef.current <= 0 &&
      !matchEndedRef.current &&
      !heroDeadOpen
    : arenaReadyHud && !heroDeadOpen;
  const showHudMatchClock =
    devMatchTimerEnabled &&
    arenaReadyHud &&
    preMatchLeftRef.current <= 0;
  const preMatchCeil =
    preMatchLeftRef.current > 0
      ? Math.max(1, Math.ceil(preMatchLeftRef.current))
      : 0;
  const matchClockShown = matchClockRef.current;
  const phaseShown = matchPhaseLabel(matchClockShown);

  // Sky background is oversized so parallax translation never reveals empty edges.
  const skyW = arenaW * 1.9;
  const skyH = arenaInnerH * 1.7;
  const skyLeft = (arenaW - skyW) / 2;
  const skyTop = (arenaInnerH - skyH) / 2;

  const bottomPad = Math.max(insets.bottom, 10);
  const safeRight =
    typeof insets.right === 'number' && Number.isFinite(insets.right)
      ? Math.max(0, insets.right)
      : 0;
  const actionArcRight =
    Math.max(0, safeRight - ACTION_CONTROLS_SAFE_RIGHT_NUDGE_PX) +
    ACTION_CONTROLS_RIGHT_GUTTER;

  const requestExitFromHud = useCallback(() => {
    if (gameOverOpen) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Leave arena?',
      'Your current match will end if you leave now.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  }, [gameOverOpen, navigation]);

  const dummies = dummiesRef.current;
  const debugHitW = ATTACK_HIT_W;
  const debugHitH = ATTACK_HIT_H;
  const debugHitY = playerY.current + ATTACK_HIT_Y_FROM_TOP;
  const debugHitX =
    facing.current === 'right'
      ? playerX.current + bodyW + ATTACK_HIT_FORWARD
      : playerX.current - debugHitW - ATTACK_HIT_FORWARD;

  const dmgFloats = dmgFloatsRef.current;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hud}>
        <View style={styles.hudSideLeft}>
          <Pressable onPress={requestExitFromHud} style={styles.backBtn}>
            <Text style={styles.backText}>← Exit</Text>
          </Pressable>
          <View style={styles.hudHpWrap} pointerEvents="none">
            <View style={styles.hudHpTrack}>
              <View
                style={[
                  styles.hudHpFill,
                  {
                    width: `${Math.round(
                      (heroHpRef.current / heroCombat.baseHp) * 100,
                    )}%`,
                    opacity: heroIFramesLeftRef.current > 0 ? 0.7 : 1,
                  },
                ]}
              />
            </View>
            <Text style={styles.hudHpText}>
              HP {Math.round(heroHpRef.current)}/{heroCombat.baseHp}
            </Text>
          </View>
        </View>
        <View style={styles.hudCenter}>
          {showHudMatchClock ? (
            <>
              <Text style={styles.hudPhase}>{phaseShown}</Text>
              <Text style={styles.hudClock}>
                {formatMatchClock(matchClockShown)}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.hudSideRight}>
          <View style={styles.hudRightRow}>
            <Text style={styles.hudTitle}>Arena</Text>
            <Pressable
              onPress={() => setDevOpen((o) => !o)}
              style={({ pressed }) => [
                styles.devBtn,
                pressed && styles.devBtnPressed,
              ]}
              accessibilityLabel="Toggle dev settings"
            >
              <Text style={styles.devBtnText}>Dev</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={resetArenaRound}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && styles.resetBtnPressed,
            ]}
          >
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.arenaFlex}>
        <View style={styles.arena} onLayout={onArenaLayout}>
          <View style={styles.arenaSkyBack} pointerEvents="none">
            <LottieView
              source={ARENA_SKY_LOTTIE}
              autoPlay
              loop
              resizeMode="cover"
              style={[
                {
                  position: 'absolute',
                  left: skyLeft,
                  top: skyTop,
                  width: skyW,
                  height: skyH,
                  transform: [
                    { translateX: -camX * 0.18 },
                    { translateY: -camY * 0.10 },
                  ],
                },
              ]}
            />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.worldLayer,
              {
                width: worldW,
                height: worldH,
                transform: [{ translateX: -camX }, { translateY: -camY }],
              },
            ]}
          >
            <View style={styles.platformBg}>
              <ArenaPlatformArt
                platforms={platformsWorld}
                worldW={worldW}
                worldH={worldH}
                styles={styles}
              />
            </View>

            <View
              style={[
                styles.playerWrap,
                {
                  left: px - hitDrawOffsetX,
                  top: py,
                  zIndex: 5,
                },
              ]}
            >
              <BruiserSpriteView
                anim={spriteAnimRef.current}
                walkFrame={walkFrameRef.current}
                hitFrame={hitFrameRef.current}
                facing={facing.current}
                scale={SPRITE_SCALE}
              />
            </View>

          {enemiesRef.current.map((e, idx) => {
            if (e.hp <= 0 || e.respawnLeft > 0) return null;
            return (
              <View
                key={idx}
                style={{
                  position: 'absolute',
                  left: e.x,
                  top: e.y,
                  width: e.w,
                  height: e.h,
                  backgroundColor: e.flashLeft > 0 ? '#fb7185' : '#dc2626',
                  borderWidth: 2,
                  borderColor: '#7f1d1d',
                  zIndex: 4,
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: -10,
                    width: '100%',
                    height: 6,
                    backgroundColor: '#111827',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round((e.hp / ENEMY_HP_MAX) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#f97316',
                      opacity: e.iFramesLeft > 0 ? 0.65 : 1,
                    }}
                  />
                </View>
              </View>
            );
          })}

          {devShowAttackHitbox && attackingNow ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: debugHitX,
                top: debugHitY,
                width: debugHitW,
                height: debugHitH,
                borderWidth: 2,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.20)',
                zIndex: 6,
              }}
            />
          ) : null}

          {dummies.map((d) => {
            const alive = d.hp > 0;
            if (!alive) return null;
            const hpPct = d.hp / DUMMY_HP_MAX;
            return (
              <View
                key={d.id}
                style={{
                  position: 'absolute',
                  left: d.x,
                  top: d.y,
                  width: d.w,
                  height: d.h,
                  backgroundColor: d.flashLeft > 0 ? '#fde047' : '#f59e0b',
                  borderWidth: 2,
                  borderColor: '#92400e',
                  zIndex: 4,
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: -10,
                    width: '100%',
                    height: 6,
                    backgroundColor: '#111827',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(hpPct * 100)}%`,
                      height: '100%',
                      backgroundColor: '#ef4444',
                    }}
                  />
                </View>
              </View>
            );
          })}

          {dmgFloats.map((f) => {
            const t = Math.min(1, f.age / DMG_FLOAT_LIFETIME_S);
            const y = f.y - t * DMG_FLOAT_RISE_PX;
            const opacity = 1 - t;
            return (
              <Text
                key={f.id}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: f.x,
                  top: y,
                  transform: [{ translateX: -10 }], // centers roughly
                  color: '#fde047',
                  fontWeight: '900',
                  fontSize: 16,
                  opacity,
                  zIndex: 30,
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              >
                {f.text}
              </Text>
            );
          })}
          </View>

          {/* Touchable controls sit on top of the map (no separate bottom tray). */}
          <View
            style={[styles.controlsOverlay, { paddingBottom: bottomPad }]}
            pointerEvents="box-none"
          >
            <View style={styles.controlsJoystickCluster} pointerEvents="box-none">
              <View pointerEvents="auto">
                <VirtualJoystick
                  stickRef={joyRef}
                  size={JOYSTICK_SIZE}
                  enabled={controlsLive}
                />
              </View>
            </View>
            <View
              style={[
                styles.actionArcWrap,
                { right: actionArcRight, bottom: ACTION_CONTROLS_BOTTOM_GUTTER },
              ]}
              pointerEvents="box-none"
            >
              <Pressable
                style={({ pressed }) => [
                  styles.ctrlCircleHit,
                  styles.ctrlCircleAbsolute,
                  {
                    left: ACTION_ARC_LAYOUT[0]!.left,
                    top: ACTION_ARC_LAYOUT[0]!.top,
                  },
                  !controlsLive && styles.ctrlBtnDisabled,
                  pressed && styles.ctrlPressed,
                ]}
                disabled={!controlsLive}
                onPress={() => {
                  hitQueued.current = true;
                }}
              >
                <View style={styles.ctrlCircleGloss} pointerEvents="none" />
                <Text style={styles.ctrlCircleLabel}>Hit</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.ctrlCircleDash,
                  styles.ctrlCircleAbsolute,
                  {
                    left: ACTION_ARC_LAYOUT[1]!.left,
                    top: ACTION_ARC_LAYOUT[1]!.top,
                  },
                  (!controlsLive || !dashReady) && styles.ctrlBtnDisabled,
                  pressed && styles.ctrlPressed,
                ]}
                disabled={!controlsLive || !dashReady}
                onPress={() => {
                  dashQueued.current = true;
                }}
              >
                <View style={styles.ctrlCircleGloss} pointerEvents="none" />
                <Text style={styles.ctrlCircleLabel}>Dash</Text>
                {!dashReady && <Text style={styles.ctrlCircleSub}>CD</Text>}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.ctrlCircleJump,
                  styles.ctrlCircleAbsolute,
                  {
                    left: ACTION_ARC_LAYOUT[2]!.left,
                    top: ACTION_ARC_LAYOUT[2]!.top,
                  },
                  !controlsLive && styles.ctrlBtnDisabled,
                  pressed && styles.ctrlPressed,
                ]}
                disabled={!controlsLive}
                onPress={() => {
                  jumpQueued.current = true;
                }}
              >
                <View style={styles.ctrlCircleGloss} pointerEvents="none" />
                <Text style={styles.ctrlCircleLabel}>Jump</Text>
              </Pressable>
            </View>
          </View>

          {arenaReadyHud && preMatchCeil > 0 ? (
            <View style={styles.preMatchOverlay}>
              <Text style={styles.preMatchLabel}>Get ready</Text>
              <Text style={styles.preMatchDigit}>{preMatchCeil}</Text>
            </View>
          ) : null}

          {arenaReadyHud && gameOverOpen ? (
            <View style={styles.gameOverOverlay}>
              <View style={styles.gameOverCard}>
                <Text style={styles.gameOverTitle}>Match over</Text>
                <Text style={styles.gameOverHint}>
                  Play again or return to the lobby.
                </Text>
                <View style={styles.gameOverActions}>
                  <Pressable
                    onPress={resetArenaRound}
                    style={({ pressed }) => [
                      styles.gameOverBtn,
                      styles.gameOverBtnPrimary,
                      pressed && styles.gameOverBtnPressed,
                    ]}
                  >
                    <Text style={styles.gameOverBtnPrimaryText}>Replay</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [
                      styles.gameOverBtn,
                      styles.gameOverBtnSecondary,
                      pressed && styles.gameOverBtnPressed,
                    ]}
                  >
                    <Text style={styles.gameOverBtnSecondaryText}>Exit</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {arenaReadyHud && heroDeadOpen ? (
            <View style={styles.gameOverOverlay}>
              <View style={styles.gameOverCard}>
                <Text style={styles.gameOverTitle}>You died</Text>
                <Text style={styles.gameOverHint}>
                  Replay or exit to the lobby.
                </Text>
                <View style={styles.gameOverActions}>
                  <Pressable
                    onPress={resetArenaRound}
                    style={({ pressed }) => [
                      styles.gameOverBtn,
                      styles.gameOverBtnPrimary,
                      pressed && styles.gameOverBtnPressed,
                    ]}
                  >
                    <Text style={styles.gameOverBtnPrimaryText}>Replay</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [
                      styles.gameOverBtn,
                      styles.gameOverBtnSecondary,
                      pressed && styles.gameOverBtnPressed,
                    ]}
                  >
                    <Text style={styles.gameOverBtnSecondaryText}>Exit</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {devOpen ? (
        <View style={styles.devPanelOverlay} pointerEvents="box-none">
          <View style={styles.devPanel} pointerEvents="auto">
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Match timer</Text>
              <Pressable
                onPress={() => {
                  setDevMatchTimerEnabled((v) => !v);
                  preMatchLeftRef.current = !devMatchTimerEnabled ? PRE_MATCH_COUNTDOWN_S : 0;
                  matchClockRef.current = 0;
                  matchEndedRef.current = false;
                  setGameOverOpen(false);
                  bump();
                }}
                style={({ pressed }) => [
                  styles.devChip,
                  devMatchTimerEnabled ? styles.devChipOn : styles.devChipOff,
                  pressed && styles.devChipPressed,
                ]}
              >
                <Text style={styles.devChipText}>
                  {devMatchTimerEnabled ? 'Enabled' : 'Disabled'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Enemies</Text>
              <Pressable
                onPress={() => {
                  setDevEnemiesEnabled((v) => !v);
                  if (!devEnemiesEnabled) syncEnemyCount(devEnemyCount);
                  else enemiesRef.current = [];
                  bump();
                }}
                style={({ pressed }) => [
                  styles.devChip,
                  devEnemiesEnabled ? styles.devChipOn : styles.devChipOff,
                  pressed && styles.devChipPressed,
                ]}
              >
                <Text style={styles.devChipText}>
                  {devEnemiesEnabled ? 'On' : 'Off'}
                </Text>
              </Pressable>
              <View style={styles.devStepper}>
                <Pressable
                  onPress={() => {
                    const next = Math.max(0, devEnemyCount - 1);
                    setDevEnemyCount(next);
                    if (devEnemiesEnabled) syncEnemyCount(next);
                    bump();
                  }}
                  style={({ pressed }) => [
                    styles.devStepBtn,
                    pressed && styles.devStepBtnPressed,
                  ]}
                >
                  <Text style={styles.devStepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.devValue}>{devEnemyCount}</Text>
                <Pressable
                  onPress={() => {
                    const next = Math.min(6, devEnemyCount + 1);
                    setDevEnemyCount(next);
                    if (devEnemiesEnabled) syncEnemyCount(next);
                    bump();
                  }}
                  style={({ pressed }) => [
                    styles.devStepBtn,
                    pressed && styles.devStepBtnPressed,
                  ]}
                >
                  <Text style={styles.devStepBtnText}>＋</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Dummies</Text>
              <Pressable
                onPress={() => {
                  setDevDummiesEnabled((v) => !v);
                  if (!devDummiesEnabled) {
                    spawnDummiesRandomOnPlatforms(devDummyCount, {
                      x: playerX.current,
                      y: playerY.current,
                    });
                  } else {
                    dummiesRef.current = [];
                  }
                  bump();
                }}
                style={({ pressed }) => [
                  styles.devChip,
                  devDummiesEnabled ? styles.devChipOn : styles.devChipOff,
                  pressed && styles.devChipPressed,
                ]}
              >
                <Text style={styles.devChipText}>
                  {devDummiesEnabled ? 'On' : 'Off'}
                </Text>
              </Pressable>
              <View style={styles.devStepper}>
                <Pressable
                  onPress={() => {
                    const next = Math.max(0, devDummyCount - 1);
                    setDevDummyCount(next);
                    if (devDummiesEnabled) {
                      spawnDummiesRandomOnPlatforms(next, {
                        x: playerX.current,
                        y: playerY.current,
                      });
                    }
                    bump();
                  }}
                  style={({ pressed }) => [
                    styles.devStepBtn,
                    pressed && styles.devStepBtnPressed,
                  ]}
                >
                  <Text style={styles.devStepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.devValue}>{devDummyCount}</Text>
                <Pressable
                  onPress={() => {
                    const next = Math.min(12, devDummyCount + 1);
                    setDevDummyCount(next);
                    if (devDummiesEnabled) {
                      spawnDummiesRandomOnPlatforms(next, {
                        x: playerX.current,
                        y: playerY.current,
                      });
                    }
                    bump();
                  }}
                  style={({ pressed }) => [
                    styles.devStepBtn,
                    pressed && styles.devStepBtnPressed,
                  ]}
                >
                  <Text style={styles.devStepBtnText}>＋</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Hitbox debug</Text>
              <Pressable
                onPress={() => setDevShowAttackHitbox((v) => !v)}
                style={({ pressed }) => [
                  styles.devChip,
                  devShowAttackHitbox ? styles.devChipOn : styles.devChipOff,
                  pressed && styles.devChipPressed,
                ]}
              >
                <Text style={styles.devChipText}>
                  {devShowAttackHitbox ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}


function createStyles(colors: AppColors) {
    return StyleSheet.create({

  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 40,
  },
  hudSideLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  hudCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudSideRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hudRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudPhase: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  hudClock: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
  },
  backText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  hudHpWrap: {
    marginTop: 4,
    width: 120,
  },
  hudHpTrack: {
    height: 8,
    width: '100%',
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  hudHpFill: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  hudHpText: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  hudTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  devBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  devBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  devBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  resetBtn: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  resetBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  resetBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  arenaFlex: {
    flex: 1,
    overflow: 'visible',
  },
  devPanelOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 54,
    zIndex: 80,
  },
  devPanel: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  devLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  devChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
  },
  devChipOn: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderColor: 'rgba(34, 197, 94, 0.45)',
  },
  devChipOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  devChipPressed: { opacity: 0.88 },
  devChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  devStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  devStepBtn: {
    width: 34,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devStepBtnPressed: { opacity: 0.85 },
  devStepBtnText: { color: colors.text, fontSize: 16, fontWeight: '900' },
  devValue: {
    width: 22,
    textAlign: 'center',
    color: colors.textSecondary,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  arena: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  arenaSkyBack: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },
  worldLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  arenaSkyBackImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  platformBg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  platformArtClip: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 8,
  },
  platformArtImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  playerWrap: {
    position: 'absolute',
  },
  preMatchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(12, 18, 34, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preMatchLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  preMatchDigit: {
    color: colors.text,
    fontSize: 96,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(12, 18, 34, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  gameOverCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  gameOverTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  gameOverHint: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  gameOverActions: {
    gap: 10,
  },
  gameOverBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  gameOverBtnPrimary: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
  gameOverBtnSecondary: {
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  gameOverBtnPressed: {
    opacity: 0.88,
  },
  gameOverBtnPrimaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  gameOverBtnSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  controlsJoystickCluster: {
    alignSelf: 'flex-start',
    paddingLeft: 28,
    paddingTop: 0,
  },
  actionArcWrap: {
    position: 'absolute',
    width: ACTION_ARC_W,
    height: ACTION_ARC_H,
  },
  ctrlCircleAbsolute: {
    position: 'absolute',
    overflow: 'hidden',
  },
  ctrlCircleGloss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '52%',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  ctrlCircleHit: {
    width: ACTION_CIRCLE_SIZE,
    height: ACTION_CIRCLE_SIZE,
    borderRadius: ACTION_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(220, 38, 38, 0.72)',
    shadowColor: colors.text,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctrlCircleDash: {
    width: ACTION_CIRCLE_SIZE,
    height: ACTION_CIRCLE_SIZE,
    borderRadius: ACTION_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(14, 116, 144, 0.72)',
    shadowColor: colors.text,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctrlCircleJump: {
    width: ACTION_CIRCLE_SIZE,
    height: ACTION_CIRCLE_SIZE,
    borderRadius: ACTION_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(91, 33, 182, 0.72)',
    shadowColor: colors.text,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  ctrlBtnDisabled: {
    opacity: 0.45,
  },
  ctrlPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  ctrlCircleLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  ctrlCircleSub: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 0,
  },

    });
}

