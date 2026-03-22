import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import type { RootStackParamList } from '../navigation/type';

/** Mossy tile — one stretched strip per platform hitbox. */
const ARENA_MAP_BG = require('../../assets/Mossy - FloatingPlatforms.png');

const ACTION_CIRCLE_SIZE = 54;
/** Temporarily hide the purple top border on the ground strip. */
const ARENA_SHOW_PURPLE_GROUND_LINE = false;

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerArena'>;

const MOVE_SPEED = 260;
const GRAVITY = 2200;
const JUMP_VELOCITY = -640;
const GROUND_STRIP_H = 40;
/** Hero scale (~25% smaller than prior 1.65). */
const SPRITE_SCALE = 1.65 * 0.75;
const WALK_FRAME_MS = 140;

const ATTACK_DURATION_S = 0.28;
const DASH_DURATION_S = 0.18;
const DASH_SPEED = 560;
const DASH_COOLDOWN_S = 1.0;

const MARGIN_SCREEN = 20;
const JOYSTICK_SIZE = 102;

/** Hit, Dash, Jump — degrees from +X axis (CCW); center is bottom-right of arc box. */
/** All three circles fit inside this width (no overflow past `right:` edge). */
const ACTION_ARC_W = 200;
const ACTION_ARC_H = 102;
/** Slightly larger radius = a bit more space between the three circles. */
const ACTION_ARC_R = 59;
/** Arc center — tuned so Jump’s right edge stays inside ACTION_ARC_W. */
const ACTION_ARC_CENTER_X = 116;
const ACTION_ARC_CENTER_Y = ACTION_ARC_H - 8;
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
const ACTION_CONTROLS_RIGHT_GUTTER = 0;

function overlapX(
  ax: number,
  aw: number,
  p: Pick<PlatformWorld, 'x' | 'w'>,
  inset = 4,
): boolean {
  return ax + aw > p.x + inset && ax < p.x + p.w - inset;
}

/** Visual slabs aligned 1:1 with physics hitboxes from `buildArenaPlatforms`. */
function ArenaPlatformArt({
  platforms,
  arenaW,
  arenaH,
}: {
  platforms: PlatformWorld[];
  arenaW: number;
  arenaH: number;
}) {
  if (arenaW < 2 || arenaH < 2) return null;
  return (
    <>
      {platforms.map((p, i) => (
        <View
          key={i}
          style={[
            styles.platformArtClip,
            {
              left: `${(p.x / arenaW) * 100}%`,
              top: `${(p.y / arenaH) * 100}%`,
              width: `${(p.w / arenaW) * 100}%`,
              height: `${(p.h / arenaH) * 100}%`,
            },
          ]}
          accessibilityLabel={`Platform ${i + 1}`}
        >
          <Image
            source={ARENA_MAP_BG}
            style={styles.platformArtImage}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
          />
        </View>
      ))}
    </>
  );
}

export default function BrawlerArenaScreen({ navigation, route }: Props) {
  const { heroId } = route.params;
  const insets = useSafeAreaInsets();

  const [arenaBox, setArenaBox] = useState({ w: 0, h: 0 });
  const arenaW = arenaBox.w || 1;
  const arenaInnerH = arenaBox.h || 1;

  const bodyW = BRUISER_FRAME_PX.w * SPRITE_SCALE;
  const bodyH = BRUISER_FRAME_PX.h * SPRITE_SCALE;

  const floorY = useMemo(
    () => Math.max(0, arenaInnerH - GROUND_STRIP_H - bodyH - 4),
    [arenaInnerH, bodyH],
  );

  const platformsWorld = useMemo(
    () => buildArenaPlatforms(arenaW, arenaInnerH, GROUND_STRIP_H, 4),
    [arenaW, arenaInnerH],
  );

  const playerX = useRef(0);
  const playerY = useRef(0);
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

  const bump = useCallback(() => {
    setRenderTick((t) => (t + 1) % 1_000_000);
  }, []);

  useEffect(() => {
    if (arenaW < 32 || arenaInnerH < 32) return;
    const eg = HERO_FEET_EMBED_GROUND_PLATFORM_PX;
    const ef = HERO_FEET_EMBED_FLOATING_PLATFORM_PX;
    if (
      lastSpawnKey.current.w === arenaW &&
      lastSpawnKey.current.h === arenaInnerH &&
      lastSpawnKey.current.embedG === eg &&
      lastSpawnKey.current.embedF === ef
    ) {
      return;
    }
    lastSpawnKey.current = {
      w: arenaW,
      h: arenaInnerH,
      embedG: eg,
      embedF: ef,
    };
    const spawn = spawnOnBottomPlatform(
      arenaW,
      arenaInnerH,
      bodyW,
      bodyH,
      MARGIN_SCREEN,
      GROUND_STRIP_H,
      4,
    );
    playerX.current = spawn.x;
    playerY.current = spawn.y;
    prevPlayerY.current = spawn.y;
  }, [
    arenaW,
    arenaInnerH,
    bodyW,
    bodyH,
    HERO_FEET_EMBED_GROUND_PLATFORM_PX,
    HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
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

      const plats = platformsRef.current;
      const prevY = prevPlayerY.current;

      dashCooldownLeft.current = Math.max(0, dashCooldownLeft.current - dt);

      const wasDashing = dashTimeLeft.current > 0;
      dashTimeLeft.current = Math.max(0, dashTimeLeft.current - dt);
      if (wasDashing && dashTimeLeft.current <= 0) {
        dashCooldownLeft.current = DASH_COOLDOWN_S;
      }

      attackTimeLeft.current = Math.max(0, attackTimeLeft.current - dt);

      if (
        hitQueued.current &&
        attackTimeLeft.current <= 0 &&
        dashTimeLeft.current <= 0
      ) {
        hitQueued.current = false;
        attackTimeLeft.current = ATTACK_DURATION_S;
        hitFrameRef.current = 0;
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
      }

      if (attackTimeLeft.current <= 0) {
        hitFrameRef.current = 0;
      }

      const dashing = dashTimeLeft.current > 0;
      const attacking = attackTimeLeft.current > 0;

      if (dashing) {
        const dir = facing.current === 'right' ? 1 : -1;
        vx.current = dir * DASH_SPEED;
      } else if (!attacking) {
        const jx = joyRef.current.x;
        if (Math.abs(jx) > 0.02) {
          vx.current = jx * MOVE_SPEED;
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
      const maxX = arenaW - MARGIN_SCREEN - bodyW;
      playerX.current = Math.max(minX, Math.min(maxX, playerX.current));

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
          if (!overlapX(playerX.current, bodyW, p)) continue;
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
          if (!overlapX(playerX.current, bodyW, p)) continue;
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
      const horizOnBottom = overlapX(playerX.current, bodyW, bot, 0);

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
          if (!overlapX(playerX.current, bodyW, p)) continue;
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

      // Fell through a bottom-deck gap — respawn only after dropping past the view.
      const feetBottom = playerY.current + bodyH;
      if (feetBottom > arenaInnerH + 36) {
        const spawn = spawnOnBottomPlatform(
          arenaW,
          arenaInnerH,
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
    bump,
    bodyW,
    bodyH,
    floorY,
    HERO_FEET_EMBED_GROUND_PLATFORM_PX,
    HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
  ]);

  const px = Math.round(playerX.current);
  const py = Math.round(playerY.current);
  const attackingNow = spriteAnimRef.current === 'hit';
  const hitFineSheetPx = attackingNow
    ? BRUISER_HIT_FINE_OFFSET_SHEET_PX[facing.current]
    : 0;
  const hitDrawOffsetX =
    (BRUISER_HIT_ANCHOR_OFFSET_X + hitFineSheetPx) * SPRITE_SCALE;

  const dashReady = dashCooldownLeft.current <= 0 && dashTimeLeft.current <= 0;

  const bottomPad = Math.max(insets.bottom, 10);
  const safeRight =
    typeof insets.right === 'number' && Number.isFinite(insets.right)
      ? Math.max(0, insets.right)
      : 0;
  const actionArcRight =
    Math.max(0, safeRight - ACTION_CONTROLS_SAFE_RIGHT_NUDGE_PX) +
    ACTION_CONTROLS_RIGHT_GUTTER;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hud}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Exit</Text>
        </Pressable>
        <Text style={styles.hudTitle}>Arena</Text>
      </View>

      <View style={styles.arenaFlex}>
        <View style={styles.arena} onLayout={onArenaLayout}>
          <View style={styles.platformBg}>
            <ArenaPlatformArt
              platforms={platformsWorld}
              arenaW={arenaW}
              arenaH={arenaInnerH}
            />
            <View
              style={[
                styles.ground,
                !ARENA_SHOW_PURPLE_GROUND_LINE && styles.groundNoPurpleLine,
              ]}
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

          {/* Touchable controls sit on top of the map (no separate bottom tray). */}
          <View
            style={[styles.controlsOverlay, { paddingBottom: bottomPad }]}
            pointerEvents="box-none"
          >
            <View style={styles.controlsJoystickCluster} pointerEvents="box-none">
              <View pointerEvents="auto">
                <VirtualJoystick stickRef={joyRef} size={JOYSTICK_SIZE} />
              </View>
            </View>
            <View
              style={[
                styles.actionArcWrap,
                { right: actionArcRight, bottom: 0 },
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
                  pressed && styles.ctrlPressed,
                ]}
                onPress={() => {
                  hitQueued.current = true;
                }}
              >
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
                  !dashReady && styles.ctrlBtnDisabled,
                  pressed && styles.ctrlPressed,
                ]}
                disabled={!dashReady}
                onPress={() => {
                  dashQueued.current = true;
                }}
              >
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
                  pressed && styles.ctrlPressed,
                ]}
                onPress={() => {
                  jumpQueued.current = true;
                }}
              >
                <Text style={styles.ctrlCircleLabel}>Jump</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0c1222',
  },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 8,
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  backText: { color: '#e2e8f0', fontWeight: '800', fontSize: 12 },
  hudTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  arenaFlex: {
    flex: 1,
    overflow: 'visible',
  },
  arena: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  platformBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a2e1a',
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
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: GROUND_STRIP_H,
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
    borderTopWidth: 2,
    borderTopColor: '#7c3aed',
  },
  groundNoPurpleLine: {
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  playerWrap: {
    position: 'absolute',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  controlsJoystickCluster: {
    alignSelf: 'flex-start',
    paddingLeft: 12,
    paddingTop: 8,
  },
  actionArcWrap: {
    position: 'absolute',
    width: ACTION_ARC_W,
    height: ACTION_ARC_H,
  },
  ctrlCircleAbsolute: {
    position: 'absolute',
  },
  ctrlCircleHit: {
    width: ACTION_CIRCLE_SIZE,
    height: ACTION_CIRCLE_SIZE,
    borderRadius: ACTION_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: '#9a3412',
    borderColor: '#ea580c',
  },
  ctrlCircleDash: {
    width: ACTION_CIRCLE_SIZE,
    height: ACTION_CIRCLE_SIZE,
    borderRadius: ACTION_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: '#0e7490',
    borderColor: '#22d3ee',
  },
  ctrlCircleJump: {
    width: ACTION_CIRCLE_SIZE,
    height: ACTION_CIRCLE_SIZE,
    borderRadius: ACTION_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: '#5b21b6',
    borderColor: '#7c3aed',
  },
  ctrlBtnDisabled: {
    opacity: 0.45,
  },
  ctrlPressed: { opacity: 0.85 },
  ctrlCircleLabel: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '900',
  },
  ctrlCircleSub: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 1,
  },
});
