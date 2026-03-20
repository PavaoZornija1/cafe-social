import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
  BRUISER_WEAPON_HIT,
  BRUISER_WEAPON_HIT_MAX_FRAME_WIDTH_PX,
} from '../brawler/bruiserSpritesheet';
import type { RootStackParamList } from '../navigation/type';

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerArena'>;

const MOVE_SPEED = 260;
const GRAVITY = 2200;
const JUMP_VELOCITY = -640;
const GROUND_STRIP_H = 56;
const SPRITE_SCALE = 2;
const WALK_FRAME_MS = 140;

const ATTACK_DURATION_S = 0.55;
const HIT_FRAME_MS = 88;
const DASH_DURATION_S = 0.18;
const DASH_SPEED = 560;
const DASH_COOLDOWN_S = 1.0;

export default function BrawlerArenaScreen({ navigation, route }: Props) {
  const { heroId } = route.params;
  const insets = useSafeAreaInsets();

  const [arenaBox, setArenaBox] = useState({ w: 0, h: 0 });
  const arenaW = arenaBox.w || 1;
  const arenaInnerH = arenaBox.h || 1;

  const spriteDisplayH = 64 * SPRITE_SCALE;
  const floorY = Math.max(
    0,
    arenaInnerH - GROUND_STRIP_H - spriteDisplayH - 4,
  );

  const playerX = useRef(0);
  const playerY = useRef(0);
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
  const hitFrameAccum = useRef(0);

  const [, setRenderTick] = useState(0);
  const spriteAnimRef = useRef<BruiserSpriteAnim>('idle');
  const walkFrameRef = useRef(0);
  const walkAccum = useRef(0);
  const layoutInitDone = useRef(false);

  const bump = useCallback(() => {
    setRenderTick((t) => (t + 1) % 1_000_000);
  }, []);

  useEffect(() => {
    if (arenaBox.w > 0 && arenaBox.h > 0 && !layoutInitDone.current) {
      layoutInitDone.current = true;
      playerX.current = arenaBox.w / 2 - 32 * SPRITE_SCALE;
      playerY.current = floorY;
    }
  }, [arenaBox.w, arenaBox.h, floorY]);

  useEffect(() => {
    if (heroId !== BRUISER_ARENA_HERO_ID) {
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
    }
  }, [heroId, navigation, route.params.venueId]);

  const onArenaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArenaBox({ w: width, h: height });
  }, []);

  useEffect(() => {
    if (arenaBox.h <= 0) return;
    const rafRef = { current: 0 };
    let cancelled = false;
    let last =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    const step = (now: number) => {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      dashCooldownLeft.current = Math.max(0, dashCooldownLeft.current - dt);

      const wasDashing = dashTimeLeft.current > 0;
      dashTimeLeft.current = Math.max(0, dashTimeLeft.current - dt);
      if (wasDashing && dashTimeLeft.current <= 0) {
        dashCooldownLeft.current = DASH_COOLDOWN_S;
      }

      attackTimeLeft.current = Math.max(0, attackTimeLeft.current - dt);

      if (hitQueued.current && attackTimeLeft.current <= 0 && dashTimeLeft.current <= 0) {
        hitQueued.current = false;
        attackTimeLeft.current = ATTACK_DURATION_S;
        hitFrameRef.current = 0;
        hitFrameAccum.current = 0;
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

      if (attackTimeLeft.current > 0) {
        hitFrameAccum.current += dt * 1000;
        const lastHitFrame = BRUISER_WEAPON_HIT.frameCount - 1;
        while (
          hitFrameAccum.current >= HIT_FRAME_MS &&
          hitFrameRef.current < lastHitFrame
        ) {
          hitFrameAccum.current -= HIT_FRAME_MS;
          hitFrameRef.current += 1;
        }
      } else {
        hitFrameRef.current = 0;
        hitFrameAccum.current = 0;
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

      const margin = 24;
      const bodyW = BRUISER_FRAME_PX.w * SPRITE_SCALE;
      let minX = margin;
      let maxX = arenaW - margin - bodyW;
      /** Wide hit clip is drawn at `left: px - hitPadL` with width `hitW` — keep it inside arena. */
      if (attackTimeLeft.current > 0) {
        const fine = BRUISER_HIT_FINE_OFFSET_SHEET_PX[facing.current];
        const hitPadL = (BRUISER_HIT_ANCHOR_OFFSET_X + fine) * SPRITE_SCALE;
        const hitW = BRUISER_WEAPON_HIT_MAX_FRAME_WIDTH_PX * SPRITE_SCALE;
        minX = margin + hitPadL;
        maxX = Math.min(maxX, arenaW - margin - hitW + hitPadL);
      }
      const xLo = Math.min(minX, maxX);
      const xHi = Math.max(minX, maxX);
      playerX.current = Math.max(xLo, Math.min(xHi, playerX.current));

      if (jumpQueued.current && onGround.current && !attacking) {
        vy.current = JUMP_VELOCITY;
        onGround.current = false;
        jumpQueued.current = false;
      }

      vy.current += GRAVITY * dt;
      playerY.current += vy.current * dt;

      if (playerY.current >= floorY) {
        playerY.current = floorY;
        vy.current = 0;
        onGround.current = true;
      } else {
        onGround.current = false;
      }

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
  }, [arenaW, arenaBox.h, bump, floorY]);

  const px = Math.round(playerX.current);
  const py = Math.round(playerY.current);
  const attackingNow = spriteAnimRef.current === 'hit';
  /** Align wide 192px hit strip to same logical 64px anchor as idle (see bruiserSpritesheet). */
  const hitFineSheetPx = attackingNow
    ? BRUISER_HIT_FINE_OFFSET_SHEET_PX[facing.current]
    : 0;
  const hitDrawOffsetX = attackingNow
    ? (BRUISER_HIT_ANCHOR_OFFSET_X + hitFineSheetPx) * SPRITE_SCALE
    : 0;

  const dashReady = dashCooldownLeft.current <= 0 && dashTimeLeft.current <= 0;

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
            <View style={[styles.ground, { width: '100%' }]} />
          </View>

        <View
          style={[
            styles.playerWrap,
            {
              left: px - hitDrawOffsetX,
              top: py,
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
        </View>
      </View>

      <View style={[styles.controlsWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.controlsMainRow}>
          <VirtualJoystick stickRef={joyRef} size={148} />
          <View style={styles.actionsColumn}>
            <Pressable
              style={({ pressed }) => [
                styles.ctrlBtnJump,
                pressed && styles.ctrlPressed,
              ]}
              onPress={() => {
                jumpQueued.current = true;
              }}
            >
              <Text style={styles.ctrlLabel}>Jump</Text>
            </Pressable>
            <View style={styles.hitDashRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.ctrlBtnHit,
                  pressed && styles.ctrlPressed,
                ]}
                onPress={() => {
                  hitQueued.current = true;
                }}
              >
                <Text style={styles.ctrlLabel}>Hit</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.ctrlBtnDash,
                  !dashReady && styles.ctrlBtnDisabled,
                  pressed && styles.ctrlPressed,
                ]}
                disabled={!dashReady}
                onPress={() => {
                  dashQueued.current = true;
                }}
              >
                <Text style={styles.ctrlLabel}>Dash</Text>
                {!dashReady && <Text style={styles.ctrlSub}>CD</Text>}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  backText: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  hudTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  arenaFlex: {
    flex: 1,
    overflow: 'visible',
  },
  arena: {
    flex: 1,
    position: 'relative',
    // Hit uses ~384px-wide clips; allow draw past bounds when parent allows (clamp still keeps px safe).
    overflow: 'visible',
  },
  platformBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111827',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: GROUND_STRIP_H,
    backgroundColor: '#334155',
    borderTopWidth: 3,
    borderTopColor: '#7c3aed',
  },
  playerWrap: {
    position: 'absolute',
  },
  controlsWrap: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  controlsMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionsColumn: {
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  hitDashRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  ctrlBtnJump: {
    backgroundColor: '#5b21b6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  ctrlBtnHit: {
    flex: 1,
    backgroundColor: '#9a3412',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ea580c',
  },
  ctrlBtnDash: {
    flex: 1,
    backgroundColor: '#0e7490',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22d3ee',
  },
  ctrlBtnDisabled: {
    opacity: 0.45,
  },
  ctrlPressed: { opacity: 0.85 },
  ctrlLabel: { color: '#f8fafc', fontSize: 16, fontWeight: '900' },
  ctrlSub: { color: '#94a3b8', fontSize: 10, fontWeight: '700', marginTop: 2 },
});
