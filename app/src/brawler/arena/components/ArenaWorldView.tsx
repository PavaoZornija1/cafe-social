import React from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { HeroSpriteView, type HeroSpriteAnim } from '../../../components/HeroSpriteView';
import { VirtualJoystick } from '../../../components/VirtualJoystick';
import type { HeroSpriteConfig } from '../../heroSpriteTypes';
import type { PlatformWorld } from '../../arenaPlatforms';
import { ACTION_ARC_LAYOUT } from '../actionArc';
import {
  ACTION_CONTROLS_BOTTOM_GUTTER,
  ARENA_SKY_LOTTIE,
  ATTACK_HIT_H,
  ATTACK_HIT_W,
  DMG_FLOAT_LIFETIME_S,
  DMG_FLOAT_RISE_PX,
  DUMMY_HP_MAX,
  ENEMY_HP_MAX,
  JOYSTICK_SIZE,
} from '../constants';
import type { ArenaStyles } from '../styles';
import type { Dummy, DmgFloat, Enemy, SpawnedPowerup } from '../types';
import { ActionTapButton } from './ActionTapButton';
import { ArenaPlatformArt } from './ArenaPlatformArt';
import { ArenaGameOverOverlay, ArenaPreMatchOverlay } from './ArenaOverlays';

type Props = {
  styles: ArenaStyles;
  onArenaLayout: (e: LayoutChangeEvent) => void;
  worldW: number;
  worldH: number;
  arenaW: number;
  arenaInnerH: number;
  camX: number;
  camY: number;
  skyW: number;
  skyH: number;
  skyLeft: number;
  skyTop: number;
  platformsWorld: PlatformWorld[];
  powerups: SpawnedPowerup[];
  px: number;
  py: number;
  hitDrawOffsetX: number;
  heroSprite: HeroSpriteConfig | undefined;
  spriteAnim: HeroSpriteAnim;
  walkFrame: number;
  hitFrame: number;
  facing: 'left' | 'right';
  spriteScale: number;
  enemies: Enemy[];
  dummies: Dummy[];
  dmgFloats: DmgFloat[];
  devShowAttackHitbox: boolean;
  attackingNow: boolean;
  debugHitX: number;
  debugHitY: number;
  bottomPad: number;
  actionArcRight: number;
  controlsLive: boolean;
  dashReady: boolean;
  joystickGesture: unknown | null;
  joyRef: React.MutableRefObject<{ x: number; y: number }>;
  onJoystickGestureReady: (gesture: unknown | null) => void;
  onHitTap: () => void;
  onDashTap: () => void;
  onJumpTap: () => void;
  showPreMatchOverlay: boolean;
  preMatchCeil: number;
  showMatchOverOverlay: boolean;
  showHeroDeadOverlay: boolean;
  onReplay: () => void;
  onExit: () => void;
};

export function ArenaWorldView({
  styles,
  onArenaLayout,
  worldW,
  worldH,
  arenaW,
  arenaInnerH,
  camX,
  camY,
  skyW,
  skyH,
  skyLeft,
  skyTop,
  platformsWorld,
  powerups,
  px,
  py,
  hitDrawOffsetX,
  heroSprite,
  spriteAnim,
  walkFrame,
  hitFrame,
  facing,
  spriteScale,
  enemies,
  dummies,
  dmgFloats,
  devShowAttackHitbox,
  attackingNow,
  debugHitX,
  debugHitY,
  bottomPad,
  actionArcRight,
  controlsLive,
  dashReady,
  joystickGesture,
  joyRef,
  onJoystickGestureReady,
  onHitTap,
  onDashTap,
  onJumpTap,
  showPreMatchOverlay,
  preMatchCeil,
  showMatchOverOverlay,
  showHeroDeadOverlay,
  onReplay,
  onExit,
}: Props) {
  const arenaReadyHud = arenaW >= 32 && arenaInnerH >= 32;
  const debugHitW = ATTACK_HIT_W;
  const debugHitH = ATTACK_HIT_H;

  return (
    <View style={styles.arena} onLayout={onArenaLayout}>
      <View style={styles.arenaSkyBack} pointerEvents="none">
        <LottieView
          source={ARENA_SKY_LOTTIE}
          autoPlay
          loop
          resizeMode="cover"
          style={{
            position: 'absolute',
            left: skyLeft,
            top: skyTop,
            width: skyW,
            height: skyH,
            transform: [
              { translateX: -camX * 0.18 },
              { translateY: -camY * 0.1 },
            ],
          }}
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

        {powerups.map((p) => (
          <View
            key={p.spawnId}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: p.x - p.r,
              top: p.y - p.r,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: p.r,
              backgroundColor: 'rgba(34, 211, 238, 0.30)',
              borderWidth: 2,
              borderColor: '#22d3ee',
              zIndex: 3,
            }}
          />
        ))}

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
          {heroSprite ? (
            <HeroSpriteView
              config={heroSprite}
              anim={spriteAnim}
              walkFrame={walkFrame}
              hitFrame={hitFrame}
              facing={facing}
              scale={spriteScale}
            />
          ) : null}
        </View>

        {enemies.map((e, idx) => {
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
                backgroundColor: e.flashLeft > 0 ? '#fca5a5' : '#dc2626',
                borderWidth: 2,
                borderColor: '#7f1d1d',
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
                transform: [{ translateX: -10 }],
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
              onGestureReady={onJoystickGestureReady}
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
          <ActionTapButton
            kind="hit"
            enabled={controlsLive}
            label="Hit"
            left={ACTION_ARC_LAYOUT[0]!.left}
            top={ACTION_ARC_LAYOUT[0]!.top}
            joystickGesture={joystickGesture}
            onTap={onHitTap}
            styles={styles}
          />
          <ActionTapButton
            kind="dash"
            enabled={controlsLive && dashReady}
            label="Dash"
            subLabel={!dashReady ? 'CD' : undefined}
            left={ACTION_ARC_LAYOUT[1]!.left}
            top={ACTION_ARC_LAYOUT[1]!.top}
            joystickGesture={joystickGesture}
            onTap={onDashTap}
            styles={styles}
          />
          <ActionTapButton
            kind="jump"
            enabled={controlsLive}
            label="Jump"
            left={ACTION_ARC_LAYOUT[2]!.left}
            top={ACTION_ARC_LAYOUT[2]!.top}
            joystickGesture={joystickGesture}
            onTap={onJumpTap}
            styles={styles}
          />
        </View>
      </View>

      {showPreMatchOverlay ? (
        <ArenaPreMatchOverlay styles={styles} countdown={preMatchCeil} />
      ) : null}

      {arenaReadyHud && showMatchOverOverlay ? (
        <ArenaGameOverOverlay
          styles={styles}
          title="Match over"
          hint="Play again or return to the lobby."
          onReplay={onReplay}
          onExit={onExit}
        />
      ) : null}

      {arenaReadyHud && showHeroDeadOverlay ? (
        <ArenaGameOverOverlay
          styles={styles}
          title="You died"
          hint="Replay or exit to the lobby."
          onReplay={onReplay}
          onExit={onExit}
        />
      ) : null}
    </View>
  );
}
