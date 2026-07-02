import React from 'react';
import { LayoutChangeEvent, Text, View, type ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';
import { HeroSpriteView, type HeroSpriteAnim } from '../../../components/HeroSpriteView';
import type { HeroSpriteConfig } from '../../heroSpriteTypes';
import type { PlatformWorld } from '../../arenaPlatforms';
import type { ArenaSafeInsets } from '../arenaSafeArea';
import {
  ARENA_SKY_LOTTIE,
  ATTACK_HIT_H,
  ATTACK_HIT_W,
  DMG_FLOAT_LIFETIME_S,
  DMG_FLOAT_RISE_PX,
  DUMMY_HP_MAX,
  ENEMY_HP_MAX,
} from '../constants';
import type { ArenaStyles } from '../styles';
import type { BrawlerPowerupDef, Dummy, DmgFloat, Enemy, SpawnedPowerup } from '../types';
import {
  PowerupPickupIcon,
  powerupEffectTypeFromId,
} from './PowerupPickupIcon';
import { ArenaControlTouchLayer } from './ArenaControlTouchLayer';
import { ArenaWorldHealthBar } from './ArenaWorldHealthBar';
import { ArenaPlatformArt } from './ArenaPlatformArt';
import type { MatchPhaseKey } from '../combat';
import {
  ArenaGameOverOverlay,
  ArenaHeroDeadOverlay,
  ArenaPreMatchOverlay,
} from './ArenaOverlays';
import { ArenaPhaseAnnounceOverlay } from './ArenaPhaseAnnounceOverlay';
import { ArenaHeroStatsHud } from './ArenaHeroStatsHud';
import type { HeroStatRow } from '../heroStatHighlights';
import { ArenaSpectatePanLayer } from './ArenaSpectatePanLayer';

type Props = {
  styles: ArenaStyles;
  onArenaLayout: (e: LayoutChangeEvent) => void;
  worldW: number;
  worldH: number;
  arenaW: number;
  arenaInnerH: number;
  camX: number;
  camY: number;
  spectateCamXRef: React.MutableRefObject<number>;
  spectateCamYRef: React.MutableRefObject<number>;
  onSpectateCameraChange: () => void;
  skyW: number;
  skyH: number;
  skyLeft: number;
  skyTop: number;
  platformsWorld: PlatformWorld[];
  powerups: SpawnedPowerup[];
  powerupDefs: BrawlerPowerupDef[];
  lavaSurfaceY: number | null;
  px: number;
  py: number;
  spriteDrawOffsetY: number;
  hitDrawOffsetX: number;
  heroSprite: HeroSpriteConfig | undefined;
  spriteAnim: HeroSpriteAnim;
  walkFrame: number;
  idleFrame: number;
  hitFrame: number;
  jumpFrame: number;
  dashFrame: number;
  facing: 'left' | 'right';
  spriteScale: number;
  bodyW: number;
  heroHp: number;
  heroHpMax: number;
  heroIFramesLeft: number;
  enemies: Enemy[];
  dummies: Dummy[];
  dmgFloats: DmgFloat[];
  devShowAttackHitbox: boolean;
  attackingNow: boolean;
  debugHitX: number;
  debugHitY: number;
  actionArcRight: number;
  safeInsets: ArenaSafeInsets;
  controlsLive: boolean;
  dashReady: boolean;
  dashCooldownProgress: number;
  dashCooldownSecondsLeft: number;
  controlLabels: { hit: string; dash: string; jump: string; dashCd: string };
  joyRef: React.MutableRefObject<{ x: number; y: number }>;
  onHitTap: () => void;
  onDashTap: () => void;
  onJumpTap: () => void;
  showPreMatchOverlay: boolean;
  preMatchCeil: number;
  preMatchLabel: string;
  showMatchOverOverlay: boolean;
  gameOverTitle: string;
  gameOverHint: string;
  gameOverReplayLabel: string;
  gameOverExitLabel: string;
  showHeroDeadOverlay: boolean;
  heroDeadTitle: string;
  heroDeadBody: string;
  heroDeadLeaveLabel: string;
  heroDeadSpectateLabel: string;
  onLeaveToLobbyAfterDeath: () => void;
  onSpectateAfterDeath: () => void;
  isSpectating: boolean;
  spectatingLabel: string;
  spectatingPanHint: string;
  phaseAnnounce: { key: MatchPhaseKey; label: string } | null;
  onPhaseAnnounceDone: () => void;
  showHeroStatsHud: boolean;
  heroStatRows: HeroStatRow[];
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
  spectateCamXRef,
  spectateCamYRef,
  onSpectateCameraChange,
  skyW,
  skyH,
  skyLeft,
  skyTop,
  platformsWorld,
  powerups,
  powerupDefs,
  lavaSurfaceY,
  px,
  py,
  spriteDrawOffsetY,
  hitDrawOffsetX,
  heroSprite,
  spriteAnim,
  walkFrame,
  idleFrame,
  hitFrame,
  jumpFrame,
  dashFrame,
  facing,
  spriteScale,
  bodyW,
  heroHp,
  heroHpMax,
  heroIFramesLeft,
  enemies,
  dummies,
  dmgFloats,
  devShowAttackHitbox,
  attackingNow,
  debugHitX,
  debugHitY,
  actionArcRight,
  safeInsets,
  controlsLive,
  dashReady,
  dashCooldownProgress,
  dashCooldownSecondsLeft,
  controlLabels,
  joyRef,
  onHitTap,
  onDashTap,
  onJumpTap,
  showPreMatchOverlay,
  preMatchCeil,
  preMatchLabel,
  showMatchOverOverlay,
  gameOverTitle,
  gameOverHint,
  gameOverReplayLabel,
  gameOverExitLabel,
  showHeroDeadOverlay,
  heroDeadTitle,
  heroDeadBody,
  heroDeadLeaveLabel,
  heroDeadSpectateLabel,
  onLeaveToLobbyAfterDeath,
  onSpectateAfterDeath,
  isSpectating,
  spectatingLabel,
  spectatingPanHint,
  phaseAnnounce,
  onPhaseAnnounceDone,
  showHeroStatsHud,
  heroStatRows,
  onReplay,
  onExit,
}: Props) {
  const arenaReadyHud = arenaW >= 32 && arenaInnerH >= 32;
  const debugHitW = ATTACK_HIT_W;
  const debugHitH = ATTACK_HIT_H;
  const heroBarW = Math.max(52, Math.round(bodyW * 0.95));

  const skyLottie = (
    left: number,
    top: number,
    width: number,
    height: number,
    transform?: ViewStyle['transform'],
  ) => (
    <LottieView
      source={ARENA_SKY_LOTTIE}
      autoPlay
      loop
      resizeMode="cover"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        transform,
      }}
    />
  );

  const worldEntities = (
    <>
        <View style={styles.platformBg}>
          <ArenaPlatformArt
            platforms={platformsWorld}
            worldW={worldW}
            worldH={worldH}
            styles={styles}
          />
        </View>

        {powerups.map((p) => {
          const iconSize = p.r * 2;
          const effectType = powerupEffectTypeFromId(p.powerupId, powerupDefs);
          return (
            <View
              key={p.spawnId}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: p.x - p.r,
                top: p.y - p.r,
                width: iconSize,
                height: iconSize,
                zIndex: 3,
              }}
            >
              <PowerupPickupIcon effectType={effectType} size={iconSize} />
            </View>
          );
        })}

        {!isSpectating ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: px + bodyW / 2 - heroBarW / 2,
                top: py + spriteDrawOffsetY - 11,
                zIndex: 6,
              }}
            >
              <ArenaWorldHealthBar
                hp={heroHp}
                maxHp={heroHpMax}
                width={heroBarW}
                variant="hero"
                iFrames={heroIFramesLeft > 0}
              />
            </View>
            <View
              style={[
                styles.playerWrap,
                {
                  left: Math.round(px - hitDrawOffsetX),
                  top: Math.round(py + spriteDrawOffsetY),
                  zIndex: 5,
                },
              ]}
            >
              {heroSprite ? (
                <HeroSpriteView
                  config={heroSprite}
                  anim={spriteAnim}
                  walkFrame={walkFrame}
                  idleFrame={idleFrame}
                  hitFrame={hitFrame}
                  jumpFrame={jumpFrame}
                  dashFrame={dashFrame}
                  facing={facing}
                  scale={spriteScale}
                />
              ) : null}
            </View>
          </>
        ) : null}

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
                borderRadius: 6,
                zIndex: 4,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: e.w / 2 - Math.max(36, e.w * 0.9) / 2,
                  top: -9,
                  zIndex: 5,
                }}
              >
                <ArenaWorldHealthBar
                  hp={e.hp}
                  maxHp={ENEMY_HP_MAX}
                  width={Math.max(36, Math.round(e.w * 0.9))}
                  variant="enemy"
                  iFrames={e.iFramesLeft > 0}
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
          if (d.hp <= 0) return null;
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
                borderRadius: 6,
                zIndex: 4,
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: d.w / 2 - Math.max(36, d.w * 0.9) / 2,
                  top: -9,
                  zIndex: 5,
                }}
              >
                <ArenaWorldHealthBar
                  hp={d.hp}
                  maxHp={DUMMY_HP_MAX}
                  width={Math.max(36, Math.round(d.w * 0.9))}
                  variant="dummy"
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

        {lavaSurfaceY != null ? (
          <View
            pointerEvents="none"
            style={[
              styles.lavaLayer,
              {
                top: lavaSurfaceY,
                width: worldW,
                height: Math.max(0, worldH - lavaSurfaceY),
              },
            ]}
          >
            <View style={styles.lavaCrust} />
          </View>
        ) : null}
    </>
  );

  return (
    <ArenaSpectatePanLayer
      enabled={isSpectating}
      worldW={worldW}
      worldH={worldH}
      arenaW={arenaW}
      arenaInnerH={arenaInnerH}
      camXRef={spectateCamXRef}
      camYRef={spectateCamYRef}
      onCameraChange={onSpectateCameraChange}
    >
      <View style={styles.arena} onLayout={onArenaLayout}>
        <View style={styles.arenaSkyBack} pointerEvents="none">
          {skyLottie(skyLeft, skyTop, skyW, skyH, [
            { translateX: -camX * 0.18 },
            { translateY: -camY * 0.1 },
          ])}
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
          {worldEntities}
        </View>
      </View>

      <ArenaControlTouchLayer
        styles={styles}
        safeInsets={safeInsets}
        actionArcRight={actionArcRight}
        controlsLive={controlsLive}
        dashReady={dashReady}
        dashCooldownProgress={dashCooldownProgress}
        dashCooldownSecondsLeft={dashCooldownSecondsLeft}
        controlLabels={controlLabels}
        joyRef={joyRef}
        onHitTap={onHitTap}
        onDashTap={onDashTap}
        onJumpTap={onJumpTap}
      />

      {showHeroStatsHud ? (
        <ArenaHeroStatsHud
          styles={styles}
          rows={heroStatRows}
          insetStyle={{
            bottom: safeInsets.bottom + 148,
            left: safeInsets.left + 12,
          }}
        />
      ) : null}

      {showPreMatchOverlay ? (
        <ArenaPreMatchOverlay styles={styles} label={preMatchLabel} countdown={preMatchCeil} />
      ) : null}

      {arenaReadyHud && phaseAnnounce && !showPreMatchOverlay ? (
        <ArenaPhaseAnnounceOverlay
          styles={styles}
          phaseKey={phaseAnnounce.key}
          label={phaseAnnounce.label}
          onDone={onPhaseAnnounceDone}
        />
      ) : null}

      {arenaReadyHud && showMatchOverOverlay ? (
        <ArenaGameOverOverlay
          styles={styles}
          title={gameOverTitle}
          hint={gameOverHint}
          replayLabel={gameOverReplayLabel}
          exitLabel={gameOverExitLabel}
          onReplay={onReplay}
          onExit={onExit}
        />
      ) : null}

      {arenaReadyHud && isSpectating ? (
        <View
          style={[
            styles.spectateBanner,
            { top: safeInsets.top + 12 },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.spectateBannerText}>{spectatingLabel}</Text>
          <Text style={styles.spectateBannerHint}>{spectatingPanHint}</Text>
        </View>
      ) : null}

      {arenaReadyHud && showHeroDeadOverlay ? (
        <ArenaHeroDeadOverlay
          styles={styles}
          title={heroDeadTitle}
          body={heroDeadBody}
          leaveLabel={heroDeadLeaveLabel}
          spectateLabel={heroDeadSpectateLabel}
          onLeaveToLobby={onLeaveToLobbyAfterDeath}
          onSpectate={onSpectateAfterDeath}
        />
      ) : null}
    </ArenaSpectatePanLayer>
  );
}
