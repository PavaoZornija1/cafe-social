import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, LayoutChangeEvent, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HeroSpriteAnim } from '../components/HeroSpriteView';
import {
  buildArenaPlatforms,
  HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
  HERO_FEET_EMBED_GROUND_PLATFORM_PX,
  spawnOnBottomPlatform,
} from '../brawler/arenaPlatforms';
import {
  ACTION_CONTROLS_RIGHT_GUTTER,
  ACTION_CONTROLS_SAFE_RIGHT_NUDGE_PX,
  ATTACK_HIT_FORWARD,
  ATTACK_HIT_H,
  ATTACK_HIT_W,
  DEFAULT_MATCH_PHASE_CHAOS_END_S,
  DEFAULT_MATCH_PHASE_ENDGAME_END_S,
  DEFAULT_MATCH_MAX_S,
  DEFAULT_MATCH_TIMER_ENABLED,
  DEFAULT_SHOW_ATTACK_HITBOX_DEBUG,
  DMG_FLOAT_LIFETIME_S,
  DMG_FLOAT_RISE_PX,
  GROUND_STRIP_H,
  MARGIN_SCREEN,
  MAX_AIR_JUMPS,
  PRE_MATCH_COUNTDOWN_S,
  FALLBACK_ARENA_HERO_STATS,
} from '../brawler/arena/constants';
import { resolveArenaSafeInsets } from '../brawler/arena/arenaSafeArea';
import {
  arenaHeroCombat,
  computeLavaSurfaceY,
  matchElapsedFromRemaining,
  matchPhaseKey,
  matchPhaseLabelDyn,
  type MatchPhaseKey,
} from '../brawler/arena/combat';
import {
  announceForPhase,
  countAliveArenaParticipants,
  DEATH_DUEL_ANNOUNCE,
  type ArenaAnnounce,
} from '../brawler/arena/arenaAnnounces';
import {
  ArenaActivePowerupsHud,
  buildActivePowerupHudRows,
} from '../brawler/arena/components/ArenaActivePowerupsHud';
import { buildHeroStatRows } from '../brawler/arena/heroStatHighlights';
import { heroFollowCamera } from '../brawler/arena/spectateView';
import { ArenaDevPanel } from '../brawler/arena/components/ArenaDevPanel';
import { ArenaHud } from '../brawler/arena/components/ArenaHud';
import {
  ArenaVenuePvpHoldOverlay,
} from '../brawler/arena/components/ArenaOverlays';
import { ArenaWorldView } from '../brawler/arena/components/ArenaWorldView';
import type { ArenaWorldPaintHandle } from '../brawler/arena/arenaWorldPaint';
import {
  spawnDummiesRandomOnPlatforms as spawnDummiesImpl,
  spawnEnemyOnRandomPlatform as spawnEnemyImpl,
  syncEnemyCount as syncEnemyCountImpl,
} from '../brawler/arena/spawn';
import { createArenaStyles } from '../brawler/arena/styles';
import type {
  ActiveBuff,
  BrawlerPowerupDef,
  Dummy,
  DmgFloat,
  Enemy,
  SpawnedPowerup,
  TrackedParticipant,
} from '../brawler/arena/types';
import { useArenaGameLoop } from '../brawler/arena/useArenaGameLoop';
import { getHeroSpriteConfig, isArenaSpriteHero } from '../brawler/heroSpritesheets';
import {
  getAttackHitFromTopPx,
  getBodyScale,
  getSpriteDrawOffsetY,
} from '../brawler/heroSpriteUtils';
import type { RootStackParamList } from '../navigation/type';
import { applyArenaSocketEvent, denormalizeSocketSpawns } from '../brawler/arena/arenaRealtime';
import {
  reconcileCombatSnapshot,
  type BrawlerCombatSocketPayload,
} from '../brawler/arena/combatRealtime';
import { shouldHoldTwoHumanPvp, resolveLocalFinalizeWinner } from '../brawler/arena/brawlerPvpHold';
import { apiGet, apiPost } from '../lib/api';
import { triggerFeedback } from '../lib/feedback';
import { useQueryClient } from '@tanstack/react-query';
import { emitPlatformQuestProgressChanged } from '../lib/platformQuestEvents';
import { invalidatePostGameProgress } from '../query/invalidateVenueSession';
import { PostGameCarouselModal } from '../components/postGame';
import type { PostGamePayload } from '../lib/postGame/types';
import { useBrawlerSocket } from '../lib/useBrawlerSocket';
import type { MeSummaryDto } from '../lib/meSummary';
import { useVenueActivePlayBudgetSync } from '../lib/useVenueActivePlayBudgetSync';
import { useAppTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'BrawlerArena'>;

export default function BrawlerArenaScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createArenaStyles(colors), [colors]);
  const { heroId, heroStats: heroStatsParam, venueId: routeVenueId } = route.params;
  const insets = useSafeAreaInsets();
  const sessionId = route.params.sessionId;

  useEffect(() => {
    brawlerSnapshotRevRef.current = undefined;
  }, [sessionId]);
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const mePlayerIdRef = useRef<string | null>(null);
  const localParticipantIdRef = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const s = await apiGet<MeSummaryDto>('/players/me/summary', token);
        if (!cancelled) {
          setSubscriptionActive(Boolean(s.subscriptionActive));
          mePlayerIdRef.current = s.playerId ?? null;
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matchChaosEndSRef = useRef(DEFAULT_MATCH_PHASE_CHAOS_END_S);
  const matchEndgameEndSRef = useRef(DEFAULT_MATCH_PHASE_ENDGAME_END_S);
  const matchMaxSRef = useRef(DEFAULT_MATCH_MAX_S);

  const participantsRef = useRef<TrackedParticipant[]>([]);
  const finalizeStartedRef = useRef(false);
  const brawlerSnapshotRevRef = useRef<number | undefined>(undefined);
  const [venueTwoHumanHold, setVenueTwoHumanHold] = useState(false);
  const venueTwoHumanHoldRef = useRef(false);
  const [trackedSessionReady, setTrackedSessionReady] = useState(!sessionId);
  /** Same tick as session fetch success — avoids RAF running before React commits `setTrackedSessionReady`. */
  const trackedSessionGateRef = useRef(!sessionId);
  /** Same tick as session sets `setDevMatchTimerEnabled(true)` — avoids RAF before `devMatchTimerLiveRef` updates. */
  const pendingMatchTimerFromSessionRef = useRef(false);
  const [matchComplete, setMatchComplete] = useState(false);
  const [postGameActive, setPostGameActive] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const arenaPaused = matchComplete || postGameActive;

  useVenueActivePlayBudgetSync({
    getToken: () => getTokenRef.current(),
    venueId: routeVenueId ?? null,
    subscriptionActive,
    kind: 'brawler',
    gameSessionId: sessionId,
    enabled: Boolean(
      routeVenueId &&
        sessionId &&
        !subscriptionActive &&
        trackedSessionReady &&
        !matchComplete,
    ),
    onBudgetExhausted: () => {
      Alert.alert(t('brawlerMatch.playTimeExhaustedTitle'), t('brawlerMatch.playTimeExhaustedBody'), [
        { text: 'OK', onPress: () => navigationRef.current.replace('MainTabs') },
      ]);
    },
  });
  const postGamePresentedRef = useRef(false);

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

  // RAF `step` must read latest flags/layout; closure from `useEffect` can lag one frame behind state.
  const devMatchTimerLiveRef = useRef(devMatchTimerEnabled);
  devMatchTimerLiveRef.current = devMatchTimerEnabled;
  const arenaWLiveRef = useRef(arenaW);
  arenaWLiveRef.current = arenaW;
  const arenaInnerHLiveRef = useRef(arenaInnerH);
  arenaInnerHLiveRef.current = arenaInnerH;
  const worldWLiveRef = useRef(worldW);
  worldWLiveRef.current = worldW;
  const worldHLiveRef = useRef(worldH);
  worldHLiveRef.current = worldH;
  const sessionIdLiveRef = useRef(sessionId);
  sessionIdLiveRef.current = sessionId;

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

  const heroSprite = useMemo(() => getHeroSpriteConfig(heroId), [heroId]);
  const heroSpriteLiveRef = useRef(heroSprite);
  heroSpriteLiveRef.current = heroSprite;

  const playerX = useRef(0);
  const playerY = useRef(0);
  const dummiesRef = useRef<Dummy[]>([]);
  const nextDummyIdRef = useRef(1);

  const hitAppliedThisSwing = useRef(false);

  const heroHpRef = useRef(heroCombat.baseHp);
  const heroIFramesLeftRef = useRef(0);
  const [heroDeadOpen, setHeroDeadOpen] = useState(false);
  const [deathChoiceOpen, setDeathChoiceOpen] = useState(false);
  const isSpectatingRef = useRef(false);
  const spectateCamXRef = useRef(0);
  const spectateCamYRef = useRef(0);
  /** Solo + ranked: enemy kills from attack hitbox or dash hit (finalize → DB only with `sessionId`). */
  const playerKillsRef = useRef(0);
  /** Solo + ranked: hero HP reaches 0 from contact damage (finalize sends to DB only when `sessionId`). */
  const playerDeathsRef = useRef(0);
  /** Authoritative combat snapshot winner (preferred over local resolve). */
  const combatWinnerRef = useRef<string | null>(null);
  const combatEndedRef = useRef(false);
  const combatInputSeqRef = useRef(0);

  const enemiesRef = useRef<Enemy[]>([]);


  const dmgFloatsRef = useRef<DmgFloat[]>([]);
  const dmgFloatIdRef = useRef(1);

  const spriteScale = heroSprite?.displayScale ?? 1.65 * 0.75;
  const bodyScale = getBodyScale(heroSprite);
  const bodyW = (heroSprite?.framePx.w ?? 64) * bodyScale;
  const bodyH = (heroSprite?.framePx.h ?? 64) * bodyScale;
  const spriteDrawOffsetY = getSpriteDrawOffsetY(heroSprite);

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
  const airJumpsLeftRef = useRef(1);
  const dropThroughPlatformIndexRef = useRef(-1);
  const hitQueued = useRef(false);
  const dashQueued = useRef(false);

  const powerupDefsRef = useRef<BrawlerPowerupDef[]>([]);
  const powerupsOnMapRef = useRef<SpawnedPowerup[]>([]);
  const powerupSpawnAccumRef = useRef(0);
  const arenaServerTickAccumRef = useRef(0);
  const powerupPickedPendingRef = useRef<Set<string>>(new Set());

  const activeBuffsRef = useRef<ActiveBuff[]>([]);
  const powerupPickupFlashRef = useRef<{
    displayName: string;
    effectType: ActiveBuff['effectType'];
    endsAtMs: number;
  } | null>(null);

  const attackTimeLeft = useRef(0);
  const dashTimeLeft = useRef(0);
  const dashCooldownLeft = useRef(0);
  const hitFrameRef = useRef(0);
  const jumpFrameRef = useRef(0);
  const dashFrameRef = useRef(0);
  const dashHitAppliedRef = useRef(false);

  const [renderTick, setRenderTick] = useState(0);
  const worldPaintRef = useRef<ArenaWorldPaintHandle>(null);
  const spriteAnimRef = useRef<HeroSpriteAnim>('idle');
  const walkFrameRef = useRef(0);
  const walkAccum = useRef(0);
  const idleFrameRef = useRef(0);
  const idleAccum = useRef(0);
  const lastSpawnKey = useRef({
    w: 0,
    h: 0,
    embedG: -9999,
    embedF: -9999,
  });

  const preMatchLeftRef = useRef(
    DEFAULT_MATCH_TIMER_ENABLED ? PRE_MATCH_COUNTDOWN_S : 0,
  );
  /** Seconds **remaining** (countdown). Phases/lava use elapsed = max − remaining. */
  const matchClockRef = useRef(DEFAULT_MATCH_MAX_S);
  const matchEndedRef = useRef(false);
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const lastAnnouncedPhaseKeyRef = useRef<MatchPhaseKey | null>(null);
  const deathDuelAnnouncedRef = useRef(false);
  const eliminatedParticipantIdsRef = useRef<Set<string>>(new Set());
  const [arenaAnnounce, setArenaAnnounce] = useState<ArenaAnnounce | null>(null);

  const clearArenaAnnounce = useCallback(() => setArenaAnnounce(null), []);

  const bumpHud = useCallback(() => {
    setRenderTick((t) => (t + 1) % 1_000_000);
  }, []);

  const paintWorld = useCallback(() => {
    const pxNow = Math.round(playerX.current);
    const pyNow = Math.round(playerY.current);
    const spectating = isSpectatingRef.current;
    const follow = heroFollowCamera(
      pxNow,
      pyNow,
      bodyW,
      bodyH,
      worldWLiveRef.current || worldW,
      worldHLiveRef.current || worldH,
      arenaWLiveRef.current || arenaW,
      arenaInnerHLiveRef.current || arenaInnerH,
    );
    const camXNow = spectating ? spectateCamXRef.current : follow.x;
    const camYNow = spectating ? spectateCamYRef.current : follow.y;
    const attacking = spriteAnimRef.current === 'hit';
    const hitFine =
      attacking
        ? (heroSprite?.hitFineOffsetSheetPx[facing.current] ?? 0)
        : 0;
    const hitOff =
      ((heroSprite?.hitAnchorOffsetX ?? 0) + hitFine) * spriteScale;
    const elapsed = matchElapsedFromRemaining(
      matchClockRef.current,
      matchMaxSRef.current,
    );
    const lavaY = computeLavaSurfaceY(
      elapsed,
      matchEndgameEndSRef.current,
      matchMaxSRef.current,
      worldHLiveRef.current || worldH,
    );
    const debugHitH = ATTACK_HIT_H;
    const debugHitW = ATTACK_HIT_W;
    const debugHitY = pyNow + getAttackHitFromTopPx(heroSprite);
    const debugHitX =
      facing.current === 'right'
        ? pxNow + bodyW + ATTACK_HIT_FORWARD
        : pxNow - debugHitW - ATTACK_HIT_FORWARD;

    worldPaintRef.current?.paint({
      camX: camXNow,
      camY: camYNow,
      px: pxNow,
      py: pyNow,
      spriteDrawOffsetY,
      hitDrawOffsetX: hitOff,
      bodyW,
      heroHp: heroHpRef.current,
      heroHpMax: heroCombat.baseHp,
      heroIFrames: heroIFramesLeftRef.current > 0,
      facing: facing.current,
      enemies: enemiesRef.current.map((e) => ({
        x: e.x,
        y: e.y,
        w: e.w,
        h: e.h,
        hp: e.hp,
        visible: e.hp > 0 && e.respawnLeft <= 0,
        flash: e.flashLeft > 0,
        iFrames: e.iFramesLeft > 0,
      })),
      dummies: dummiesRef.current.map((d) => ({
        id: d.id,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        hp: d.hp,
        visible: d.hp > 0,
        flash: d.flashLeft > 0,
      })),
      lavaSurfaceY: lavaY,
      worldH: worldHLiveRef.current || worldH,
      worldW: worldWLiveRef.current || worldW,
      debugHit:
        DEFAULT_SHOW_ATTACK_HITBOX_DEBUG && attacking
          ? { x: debugHitX, y: debugHitY, w: debugHitW, h: debugHitH }
          : null,
      dmgFloats: dmgFloatsRef.current.map((f) => {
        const t = Math.min(1, f.age / DMG_FLOAT_LIFETIME_S);
        return {
          id: f.id,
          x: f.x,
          y: f.y - t * DMG_FLOAT_RISE_PX,
          text: f.text,
          opacity: 1 - t,
        };
      }),
    });
  }, [
    arenaInnerH,
    arenaW,
    bodyH,
    bodyW,
    heroCombat.baseHp,
    heroSprite,
    spriteDrawOffsetY,
    spriteScale,
    worldH,
    worldW,
  ]);

  const handleSpectateCameraChange = useCallback(() => {
    paintWorld();
  }, [paintWorld]);

  const bump = bumpHud;

  const refreshArenaState = useCallback(async () => {
    if (!sessionId) return;
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const state = await apiGet<{
        type: 'state';
        spawns?: Array<{
          spawnId: string;
          powerupId: string;
          nx: number;
          ny: number;
          r: number;
        }>;
      }>(`/brawler/sessions/${encodeURIComponent(sessionId)}/arena/state`, token);
      if (state.type === 'state' && state.spawns) {
        powerupsOnMapRef.current = denormalizeSocketSpawns(
          state.spawns,
          worldWLiveRef.current || 1,
          worldHLiveRef.current || 1,
        );
        bump();
      }
    } catch {
      /* */
    }
  }, [bump, sessionId]);

  const handleArenaSocketEvent = useCallback(
    (payload: Parameters<typeof applyArenaSocketEvent>[0]['payload']) => {
      const result = applyArenaSocketEvent({
        payload,
        powerupsOnMap: powerupsOnMapRef.current,
        worldW: worldWLiveRef.current || 1,
        worldH: worldHLiveRef.current || 1,
      });
      if (result.changed) {
        powerupsOnMapRef.current = result.powerupsOnMap;
        bump();
      }
    },
    [bump],
  );

  const handleCombatSocketEvent = useCallback(
    (payload: BrawlerCombatSocketPayload) => {
      if (!payload?.state) return;
      const reconciled = reconcileCombatSnapshot({
        state: payload.state,
        localParticipantId: localParticipantIdRef.current,
        worldW: worldWLiveRef.current || worldW || 1,
        worldH: worldHLiveRef.current || worldH || 1,
        bodyH,
      });

      if (reconciled.localHp != null) {
        heroHpRef.current = reconciled.localHp;
      }
      if (reconciled.localKills != null) {
        playerKillsRef.current = reconciled.localKills;
      }
      if (reconciled.localDeaths != null) {
        playerDeathsRef.current = reconciled.localDeaths;
      }
      if (reconciled.localAlive === false && !isSpectatingRef.current) {
        setHeroDeadOpen(true);
      }

      // Soft sync bot HP from authority.
      const botPixels = reconciled.fighterPixels.filter((f) => f.isBot);
      if (botPixels.length > 0 && enemiesRef.current.length > 0) {
        enemiesRef.current = enemiesRef.current.map((enemy, idx) => {
          const bot = botPixels[idx] ?? botPixels[0];
          if (!bot) return enemy;
          return {
            ...enemy,
            hp: bot.hp,
            respawnLeft: bot.alive ? 0 : Math.max(enemy.respawnLeft, 0.01),
          };
        });
      }

      if (reconciled.ended) {
        combatEndedRef.current = true;
        combatWinnerRef.current = reconciled.winnerParticipantId;
        matchEndedRef.current = true;
        setGameOverOpen(true);
      }
      bump();
    },
    [bump],
  );

  const { emitCombatInput } = useBrawlerSocket({
    sessionId,
    enabled: Boolean(sessionId && trackedSessionReady && !venueTwoHumanHold && !matchComplete),
    getToken: () => getTokenRef.current(),
    onArenaEvent: handleArenaSocketEvent,
    onCombatEvent: handleCombatSocketEvent,
    onRefresh: refreshArenaState,
  });

  useEffect(() => {
    if (!sessionId || venueTwoHumanHold || matchComplete || !trackedSessionReady) {
      return;
    }
    const id = setInterval(() => {
      combatInputSeqRef.current += 1;
      emitCombatInput({
        seq: combatInputSeqRef.current,
        moveX: joyRef.current.x,
        moveY: joyRef.current.y,
        fire: hitQueued.current || attackTimeLeft.current > 0,
      });
    }, 50);
    return () => clearInterval(id);
  }, [
    emitCombatInput,
    matchComplete,
    sessionId,
    trackedSessionReady,
    venueTwoHumanHold,
  ]);

  const queryClient = useQueryClient();
  const [postGamePayload, setPostGamePayload] = useState<PostGamePayload | null>(null);

  const completeBrawlerPostGame = useCallback(() => {
    if (!mountedRef.current) return;
    setPostGameActive(false);
    setPostGamePayload(null);
    postGamePresentedRef.current = false;
    emitPlatformQuestProgressChanged();
    void invalidatePostGameProgress(queryClient);
    navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
  }, [navigation, queryClient, route.params.venueId]);

  const dismissBrawlerPostGame = useCallback(() => {
    if (!mountedRef.current) return;
    setPostGameActive(false);
    setPostGamePayload(null);
    postGamePresentedRef.current = false;
    setGameOverOpen(true);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      trackedSessionGateRef.current = true;
    }
  }, [sessionId]);

  useEffect(() => {
    if (devMatchTimerEnabled) {
      pendingMatchTimerFromSessionRef.current = false;
    }
  }, [devMatchTimerEnabled]);

  // Only `sessionId` in deps: Clerk `getToken` changes identity every render → would refetch
  // forever and reset pre-match to 5 each time. Use `getTokenRef` inside the async body.
  useEffect(() => {
    if (!sessionId) return;
    trackedSessionGateRef.current = false;
    pendingMatchTimerFromSessionRef.current = false;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const session = await apiGet<{
          snapshotRev?: number | null;
          participants: TrackedParticipant[];
          brawlerSession: {
            chaosDurationMs: number;
            endgameDurationMs: number;
            suddenDeathMaxMs: number;
          } | null;
          config?: {
            brawler?: {
              powerups?: BrawlerPowerupDef[];
            };
          } | null;
        }>(`/brawler/sessions/${encodeURIComponent(sessionId)}`, token);
        if (cancelled) return;
        if (typeof session.snapshotRev === 'number') {
          brawlerSnapshotRevRef.current = session.snapshotRev;
        }
        const parts = session.participants ?? [];
        participantsRef.current = parts;
        powerupDefsRef.current = session.config?.brawler?.powerups ?? [];
        const mePid = mePlayerIdRef.current;
        const localPart =
          mePid != null
            ? parts.find((p) => p.playerId === mePid && !p.isBot)
            : parts.find((p) => !p.isBot);
        localParticipantIdRef.current = localPart?.id ?? null;
        // Authoritative combat is live — 2-human matches play normally (no hold overlay).
        const hold = shouldHoldTwoHumanPvp(parts);
        venueTwoHumanHoldRef.current = hold;
        setVenueTwoHumanHold(hold);
        const bs = session.brawlerSession;
        if (bs) {
          const chaosS = bs.chaosDurationMs / 1000;
          const endgameS = bs.endgameDurationMs / 1000;
          const suddenS = bs.suddenDeathMaxMs / 1000;
          matchChaosEndSRef.current = chaosS;
          matchEndgameEndSRef.current = chaosS + endgameS;
          matchMaxSRef.current = chaosS + endgameS + suddenS;
        } else {
          matchChaosEndSRef.current = DEFAULT_MATCH_PHASE_CHAOS_END_S;
          matchEndgameEndSRef.current = DEFAULT_MATCH_PHASE_ENDGAME_END_S;
          matchMaxSRef.current = DEFAULT_MATCH_MAX_S;
        }
        trackedSessionGateRef.current = true;
        pendingMatchTimerFromSessionRef.current = true;
        setDevMatchTimerEnabled(true);
        preMatchLeftRef.current = PRE_MATCH_COUNTDOWN_S;
        matchClockRef.current = matchMaxSRef.current;
        matchEndedRef.current = false;
        setGameOverOpen(false);
        setMatchComplete(false);
        setHeroDeadOpen(false);
        setDeathChoiceOpen(false);
        isSpectatingRef.current = false;
        finalizeStartedRef.current = false;
        postGamePresentedRef.current = false;
        setPostGamePayload(null);
        setPostGameActive(false);
        setTrackedSessionReady(true);
        playerKillsRef.current = 0;
        playerDeathsRef.current = 0;
        combatWinnerRef.current = null;
        combatEndedRef.current = false;
        combatInputSeqRef.current = 0;
        powerupsOnMapRef.current = [];
        powerupSpawnAccumRef.current = 0;
        powerupPickedPendingRef.current = new Set();
        activeBuffsRef.current = [];
        powerupPickupFlashRef.current = null;
        arenaServerTickAccumRef.current = 0;
        lastAnnouncedPhaseKeyRef.current = null;
        deathDuelAnnouncedRef.current = false;
        eliminatedParticipantIdsRef.current = new Set();
        setArenaAnnounce(null);
        bump();
        void refreshArenaState();
      } catch (e) {
        if (!cancelled) {
          Alert.alert(
            t('brawlerMatch.sessionLoadFailedTitle'),
            (e as Error).message || t('brawlerMatch.sessionLoadFailedBody'),
          );
          navigationRef.current.goBack();
        }
      }
    })();
    return () => {
      cancelled = true;
      trackedSessionGateRef.current = false;
      pendingMatchTimerFromSessionRef.current = false;
    };
  }, [sessionId, bump]);

  useEffect(() => {
    if (heroDeadOpen) {
      setDeathChoiceOpen(true);
    }
  }, [heroDeadOpen]);

  const presentBrawlerPostGame = useCallback(
    (postGame: PostGamePayload, won: boolean) => {
      if (!mountedRef.current || postGamePresentedRef.current) return;
      postGamePresentedRef.current = true;
      setPostGameActive(true);
      setPostGamePayload(postGame);
      setGameOverOpen(false);
      setDeathChoiceOpen(false);
      setHeroDeadOpen(false);
      isSpectatingRef.current = false;
      joyRef.current.x = 0;
      joyRef.current.y = 0;
      requestAnimationFrame(() => {
        if (mountedRef.current) triggerFeedback(won ? 'matchWin' : 'matchLoss');
      });
    },
    [],
  );

  const postBrawlerFinalize = useCallback(
    async (
      token: string,
      body: Record<string, unknown>,
    ): Promise<{ postGame?: PostGamePayload }> => {
      try {
        return await apiPost<{ postGame?: PostGamePayload }>(
          `/brawler/sessions/${encodeURIComponent(sessionId!)}/finalize`,
          body,
          token,
        );
      } catch (e) {
        const status = (e as Error & { status?: number }).status;
        if (status !== 409) throw e;
        const { winnerParticipantId, participants } = body;
        return apiPost<{ postGame?: PostGamePayload }>(
          `/brawler/sessions/${encodeURIComponent(sessionId!)}/finalize`,
          { winnerParticipantId, participants },
          token,
        );
      }
    },
    [sessionId],
  );

  const finalizeBrawlerSession = useCallback(
    async (opts: { showResults: boolean }) => {
      if (!sessionId || finalizeStartedRef.current) return;
      finalizeStartedRef.current = true;
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const bot = participantsRef.current.find((p) => p.isBot);
        const humanAlive = heroHpRef.current > 0;
        const winnerId =
          combatWinnerRef.current ??
          resolveLocalFinalizeWinner({
            localParticipantId: localParticipantIdRef.current,
            localAlive: humanAlive && !heroDeadOpen,
            botParticipantId: bot?.id,
          });
        const participantsPayload = participantsRef.current.map((p) => ({
          participantId: p.id,
          placement: p.id === winnerId ? 1 : 2,
          score: 0,
          result: (p.id === winnerId ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS',
          kills: p.id === localParticipantIdRef.current ? playerKillsRef.current : 0,
          deaths: p.id === localParticipantIdRef.current ? playerDeathsRef.current : 0,
        }));
        try {
          const latest = await apiGet<{ snapshotRev?: number | null }>(
            `/brawler/sessions/${encodeURIComponent(sessionId)}`,
            token,
          );
          if (typeof latest.snapshotRev === 'number') {
            brawlerSnapshotRevRef.current = latest.snapshotRev;
          }
        } catch {
          /* best-effort rev refresh */
        }

        const finalizeBody = combatEndedRef.current
          ? {
              ...(typeof brawlerSnapshotRevRef.current === 'number'
                ? { ifSnapshotRev: brawlerSnapshotRevRef.current }
                : {}),
            }
          : {
              winnerParticipantId: winnerId,
              participants: participantsPayload,
              ...(typeof brawlerSnapshotRevRef.current === 'number'
                ? { ifSnapshotRev: brawlerSnapshotRevRef.current }
                : {}),
            };
        const finalizeRes = await postBrawlerFinalize(token, finalizeBody);
        if (!opts.showResults) return;
        if (!mountedRef.current) return;
        const won = localParticipantIdRef.current === winnerId;
        if (finalizeRes.postGame) {
          presentBrawlerPostGame(finalizeRes.postGame, won);
        } else {
          setGameOverOpen(true);
        }
      } catch (e) {
        if (!mountedRef.current) return;
        finalizeStartedRef.current = false;
        setGameOverOpen(true);
        Alert.alert(
          t('brawlerMatch.finalizeFailedTitle'),
          (e as Error).message || t('common.error'),
        );
      }
    },
    [heroDeadOpen, postBrawlerFinalize, presentBrawlerPostGame, sessionId, t],
  );

  useEffect(() => {
    if (!sessionId || venueTwoHumanHold || !gameOverOpen) return;
    setDeathChoiceOpen(false);
    isSpectatingRef.current = false;
    setMatchComplete(true);
    void finalizeBrawlerSession({ showResults: true });
  }, [sessionId, venueTwoHumanHold, gameOverOpen, finalizeBrawlerSession]);

  const handleLeaveToLobbyAfterDeath = useCallback(() => {
    setDeathChoiceOpen(false);
    if (!sessionId) {
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
      return;
    }
    void (async () => {
      await finalizeBrawlerSession({ showResults: false });
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
    })();
  }, [finalizeBrawlerSession, navigation, route.params.venueId, sessionId]);

  const handleSpectateAfterDeath = useCallback(() => {
    const follow = heroFollowCamera(
      playerX.current,
      playerY.current,
      bodyW,
      bodyH,
      worldW,
      worldH,
      arenaW,
      arenaInnerH,
    );
    spectateCamXRef.current = follow.x;
    spectateCamYRef.current = follow.y;
    isSpectatingRef.current = true;
    setDeathChoiceOpen(false);
    bump();
  }, [arenaInnerH, arenaW, bodyH, bodyW, bump, worldH, worldW]);

  const spawnDummiesRandomOnPlatforms = useCallback(
    (count: number, heroSpawn: { x: number; y: number }) => {
      spawnDummiesImpl(
        count,
        heroSpawn,
        worldW,
        worldH,
        bodyW,
        bodyH,
        nextDummyIdRef,
        dummiesRef,
      );
    },
    [worldW, worldH, bodyW, bodyH],
  );

  const spawnEnemyOnRandomPlatform = useCallback(
    () => spawnEnemyImpl(worldW, worldH, difficultyTuning.enemySpeedMul),
    [worldW, worldH, difficultyTuning.enemySpeedMul],
  );

  const syncEnemyCount = useCallback(
    (count: number) => {
      syncEnemyCountImpl(count, worldW, worldH, difficultyTuning.enemySpeedMul, enemiesRef);
    },
    [worldW, worldH, difficultyTuning.enemySpeedMul],
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
    if (!isArenaSpriteHero(heroId)) {
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
    }
  }, [heroId, navigation, route.params.venueId]);

  useEffect(() => {
    if (!devMatchTimerEnabled) return;
    if (arenaW < 32 || arenaInnerH < 32) return;
    if (preMatchLeftRef.current > 0) return;
    if (gameOverOpen || deathChoiceOpen || venueTwoHumanHold) return;
    if (sessionId && !trackedSessionReady) return;

    const elapsed = matchElapsedFromRemaining(
      matchClockRef.current,
      matchMaxSRef.current,
    );
    const key = matchPhaseKey(
      elapsed,
      matchChaosEndSRef.current,
      matchEndgameEndSRef.current,
    );
    if (lastAnnouncedPhaseKeyRef.current === key) return;

    lastAnnouncedPhaseKeyRef.current = key;
    setArenaAnnounce(announceForPhase(key));
  }, [
    arenaInnerH,
    arenaW,
    deathChoiceOpen,
    devMatchTimerEnabled,
    gameOverOpen,
    renderTick,
    sessionId,
    trackedSessionReady,
    venueTwoHumanHold,
  ]);

  useEffect(() => {
    if (!devMatchTimerEnabled) return;
    if (arenaW < 32 || arenaInnerH < 32) return;
    if (preMatchLeftRef.current > 0) return;
    if (gameOverOpen || deathChoiceOpen || venueTwoHumanHold) return;
    if (sessionId && !trackedSessionReady) return;
    if (arenaAnnounce) return;
    if (deathDuelAnnouncedRef.current) return;

    const elapsed = matchElapsedFromRemaining(
      matchClockRef.current,
      matchMaxSRef.current,
    );
    const phase = matchPhaseKey(
      elapsed,
      matchChaosEndSRef.current,
      matchEndgameEndSRef.current,
    );
    if (phase !== 'sudden_death') return;

    if (heroHpRef.current <= 0 && localParticipantIdRef.current) {
      eliminatedParticipantIdsRef.current.add(localParticipantIdRef.current);
    }

    const alive = countAliveArenaParticipants({
      participants: participantsRef.current,
      localParticipantId: localParticipantIdRef.current,
      heroHp: heroHpRef.current,
      eliminatedParticipantIds: eliminatedParticipantIdsRef.current,
    });

    if (participantsRef.current.length < 2 || alive !== 2) return;

    deathDuelAnnouncedRef.current = true;
    setArenaAnnounce(DEATH_DUEL_ANNOUNCE);
  }, [
    arenaAnnounce,
    arenaInnerH,
    arenaW,
    deathChoiceOpen,
    devMatchTimerEnabled,
    gameOverOpen,
    renderTick,
    sessionId,
    trackedSessionReady,
    venueTwoHumanHold,
  ]);

  const onArenaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArenaBox({ w: width, h: height });
  }, []);

  const platformsRef = useRef(platformsWorld);
  platformsRef.current = platformsWorld;

  const resetArenaRound = useCallback(() => {
    if (sessionId) {
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
      return;
    }
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
    setDeathChoiceOpen(false);
    isSpectatingRef.current = false;
    playerKillsRef.current = 0;
    playerDeathsRef.current = 0;

    vx.current = 0;
    vy.current = 0;
    onGround.current = true;
    facing.current = 'right';
    joyRef.current.x = 0;
    joyRef.current.y = 0;
    jumpQueued.current = false;
    airJumpsLeftRef.current = MAX_AIR_JUMPS;
    dropThroughPlatformIndexRef.current = -1;
    hitQueued.current = false;
    dashQueued.current = false;
    attackTimeLeft.current = 0;
    dashTimeLeft.current = 0;
    dashCooldownLeft.current = 0;
    hitFrameRef.current = 0;
    jumpFrameRef.current = 0;
    dashFrameRef.current = 0;
    spriteAnimRef.current = 'idle';
    walkFrameRef.current = 0;
    walkAccum.current = 0;
    idleFrameRef.current = 0;
    idleAccum.current = 0;
    matchEndedRef.current = false;
    matchClockRef.current = matchMaxSRef.current;
    preMatchLeftRef.current = devMatchTimerEnabled ? PRE_MATCH_COUNTDOWN_S : 0;
    powerupsOnMapRef.current = [];
    powerupSpawnAccumRef.current = 0;
    arenaServerTickAccumRef.current = 0;
    powerupPickedPendingRef.current = new Set();
    activeBuffsRef.current = [];
    powerupPickupFlashRef.current = null;
    lastAnnouncedPhaseKeyRef.current = null;
    deathDuelAnnouncedRef.current = false;
    eliminatedParticipantIdsRef.current = new Set();
    setArenaAnnounce(null);
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
    sessionId,
    navigation,
    route.params.venueId,
  ]);

  const px = Math.round(playerX.current);
  const py = Math.round(playerY.current);
  const isSpectating = isSpectatingRef.current;
  const followCam = heroFollowCamera(
    px,
    py,
    bodyW,
    bodyH,
    worldW,
    worldH,
    arenaW,
    arenaInnerH,
  );
  const camX = isSpectating ? spectateCamXRef.current : followCam.x;
  const camY = isSpectating ? spectateCamYRef.current : followCam.y;
  const attackingNow = spriteAnimRef.current === 'hit';
  const hitFineSheetPx = attackingNow
    ? (heroSprite?.hitFineOffsetSheetPx[facing.current] ?? 0)
    : 0;
  const hitDrawOffsetX =
    ((heroSprite?.hitAnchorOffsetX ?? 0) + hitFineSheetPx) * spriteScale;

  const dashReady = dashCooldownLeft.current <= 0 && dashTimeLeft.current <= 0;
  const dashCooldownSecondsLeft = Math.max(0, dashCooldownLeft.current);
  const dashCooldownProgress =
    heroCombat.dashCooldownS > 0
      ? Math.max(0, Math.min(1, 1 - dashCooldownSecondsLeft / heroCombat.dashCooldownS))
      : 1;

  const arenaReadyHud = arenaW >= 32 && arenaInnerH >= 32;
  const controlsLive =
    !arenaPaused &&
    (devMatchTimerEnabled
      ? arenaReadyHud &&
        preMatchLeftRef.current <= 0 &&
        !matchEndedRef.current &&
        !heroDeadOpen
      : arenaReadyHud && !heroDeadOpen);

  useArenaGameLoop({
    arenaW,
    arenaInnerH,
    worldW,
    worldH,
    bodyW,
    bodyH,
    floorY,
    FEET_W,
    heroCombat,
    heroDeadOpen,
    isSpectatingRef,
    devMatchTimerEnabled,
    sessionId,
    arenaPaused,
    controlsLive,
    difficultyTuning,
    bumpHud,
    paintWorld,
    spawnEnemyOnRandomPlatform,
    setGameOverOpen,
    setHeroDeadOpen,
    arenaWLiveRef,
    arenaInnerHLiveRef,
    worldWLiveRef,
    worldHLiveRef,
    sessionIdLiveRef,
    trackedSessionGateRef,
    devMatchTimerLiveRef,
    pendingMatchTimerFromSessionRef,
    matchChaosEndSRef,
    matchEndgameEndSRef,
    matchMaxSRef,
    preMatchLeftRef,
    matchClockRef,
    matchEndedRef,
    platformsRef,
    playerX,
    playerY,
    prevPlayerY,
    vx,
    vy,
    onGround,
    facing,
    joyRef,
    jumpQueued,
    airJumpsLeftRef,
    dropThroughPlatformIndexRef,
    hitQueued,
    dashQueued,
    hitAppliedThisSwing,
    heroHpRef,
    heroIFramesLeftRef,
    playerKillsRef,
    playerDeathsRef,
    dummiesRef,
    enemiesRef,
    dmgFloatsRef,
    dmgFloatIdRef,
    powerupDefsRef,
    powerupsOnMapRef,
    powerupSpawnAccumRef,
    arenaServerTickAccumRef,
    powerupPickedPendingRef,
    activeBuffsRef,
    powerupPickupFlashRef,
    participantsRef,
    localParticipantIdRef,
    getTokenRef,
    dashCooldownLeft,
    dashTimeLeft,
    attackTimeLeft,
    hitFrameRef,
    jumpFrameRef,
    dashFrameRef,
    dashHitAppliedRef,
    spriteAnimRef,
    walkFrameRef,
    walkAccum,
    idleFrameRef,
    idleAccum,
    heroSpriteLiveRef,
  });

  const showHudMatchClock =
    devMatchTimerEnabled &&
    arenaReadyHud &&
    preMatchLeftRef.current <= 0;
  const preMatchCeil =
    preMatchLeftRef.current > 0
      ? Math.max(1, Math.ceil(preMatchLeftRef.current))
      : 0;
  const showPreMatchOverlay =
    arenaReadyHud &&
    preMatchCeil > 0 &&
    devMatchTimerEnabled &&
    (!sessionId || trackedSessionReady);
  const matchRemainingShown = matchClockRef.current;
  const matchElapsedShown = matchElapsedFromRemaining(
    matchRemainingShown,
    matchMaxSRef.current,
  );
  const phaseShown = matchPhaseLabelDyn(
    matchElapsedShown,
    matchChaosEndSRef.current,
    matchEndgameEndSRef.current,
  );
  const lavaSurfaceY = computeLavaSurfaceY(
    matchElapsedShown,
    matchEndgameEndSRef.current,
    matchMaxSRef.current,
    worldH,
  );

  // Sky background is oversized so parallax translation never reveals empty edges.
  const skyW = arenaW * 1.9;
  const skyH = arenaInnerH * 1.7;
  const skyLeft = (arenaW - skyW) / 2;
  const skyTop = (arenaInnerH - skyH) / 2;

  const safeInsets = useMemo(() => resolveArenaSafeInsets(insets), [insets]);
  const actionArcRight =
    Math.max(0, safeInsets.right - ACTION_CONTROLS_SAFE_RIGHT_NUDGE_PX) +
    ACTION_CONTROLS_RIGHT_GUTTER;
  const controlLabels = useMemo(
    () => ({
      hit: t('brawlerMatch.ctrlHit'),
      dash: t('brawlerMatch.ctrlDash'),
      jump: t('brawlerMatch.ctrlJump'),
      dashCd: t('brawlerMatch.ctrlDashCd'),
    }),
    [t],
  );

  const abandonVenueTwoHumanAndLeave = useCallback(async () => {
    if (!sessionId) return;
    try {
      const token = await getTokenRef.current();
      if (token) {
        await apiPost(
          `/brawler/sessions/${encodeURIComponent(sessionId)}/abandon`,
          typeof brawlerSnapshotRevRef.current === 'number'
            ? { ifSnapshotRev: brawlerSnapshotRevRef.current }
            : {},
          token,
        );
      }
    } catch {
      /* */
    }
    navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
  }, [navigation, route.params.venueId, sessionId]);

  const requestExitFromHud = useCallback(() => {
    if (postGameActive) return;
    if (venueTwoHumanHoldRef.current) {
      void abandonVenueTwoHumanAndLeave();
      return;
    }
    if (heroDeadOpen && isSpectatingRef.current) {
      handleLeaveToLobbyAfterDeath();
      return;
    }
    if (gameOverOpen) {
      navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
      return;
    }
    Alert.alert(
      t('brawlerArena.leaveTitle'),
      t('brawlerArena.leaveBody'),
      [
        { text: t('brawlerArena.cancel'), style: 'cancel' },
        {
          text: t('brawlerArena.leave'),
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  }, [abandonVenueTwoHumanAndLeave, gameOverOpen, handleLeaveToLobbyAfterDeath, heroDeadOpen, navigation, t]);

  const dummies = dummiesRef.current;
  const debugHitW = ATTACK_HIT_W;
  const debugHitH = ATTACK_HIT_H;
  const debugHitY = playerY.current + getAttackHitFromTopPx(heroSprite);
  const debugHitX =
    facing.current === 'right'
      ? playerX.current + bodyW + ATTACK_HIT_FORWARD
      : playerX.current - debugHitW - ATTACK_HIT_FORWARD;

  const dmgFloats = dmgFloatsRef.current;

  const showKdHud = arenaReadyHud && !venueTwoHumanHold;
  const matchNowMs = Math.floor(matchElapsedShown * 1000);
  const activePowerupRows = buildActivePowerupHudRows(
    activeBuffsRef.current,
    powerupDefsRef.current,
    matchNowMs,
  );
  const showPowerupHud =
    controlsLive &&
    !gameOverOpen &&
    !heroDeadOpen &&
    !showPreMatchOverlay &&
    !venueTwoHumanHold &&
    (activePowerupRows.length > 0 ||
      (powerupPickupFlashRef.current != null &&
        powerupPickupFlashRef.current.endsAtMs > matchNowMs));

  const heroStatsBase = { ...FALLBACK_ARENA_HERO_STATS, ...heroStatsParam };
  const heroStatRows = buildHeroStatRows(
    heroStatsBase,
    activeBuffsRef.current,
    matchNowMs,
    powerupPickupFlashRef.current,
  );
  const showHeroStatsHud =
    !sessionId &&
    arenaReadyHud &&
    !showPreMatchOverlay &&
    !venueTwoHumanHold &&
    (controlsLive || isSpectating);

  return (
    <View style={styles.root}>
      <View style={styles.arenaFlex}>
        {showPowerupHud ? (
          <ArenaActivePowerupsHud
            styles={styles}
            rows={activePowerupRows}
            pickupFlash={powerupPickupFlashRef.current}
            nowMs={matchNowMs}
            pickupLabel={t('brawlerMatch.powerupPickup')}
            insetStyle={{
              top: safeInsets.top + 48,
              left: safeInsets.left + 8,
              right: safeInsets.right + 8,
            }}
          />
        ) : null}

        <ArenaWorldView
          ref={worldPaintRef}
          styles={styles}
          onArenaLayout={onArenaLayout}
          worldW={worldW}
          worldH={worldH}
          arenaW={arenaW}
          arenaInnerH={arenaInnerH}
          camX={camX}
          camY={camY}
          spectateCamXRef={spectateCamXRef}
          spectateCamYRef={spectateCamYRef}
          onSpectateCameraChange={handleSpectateCameraChange}
          skyW={skyW}
          skyH={skyH}
          skyLeft={skyLeft}
          skyTop={skyTop}
          platformsWorld={platformsWorld}
          powerups={powerupsOnMapRef.current}
          powerupDefs={powerupDefsRef.current}
          lavaSurfaceY={lavaSurfaceY}
          px={px}
          py={py}
          spriteDrawOffsetY={spriteDrawOffsetY}
          hitDrawOffsetX={hitDrawOffsetX}
          heroSprite={heroSprite}
          spriteAnim={spriteAnimRef.current}
          walkFrame={walkFrameRef.current}
          idleFrame={idleFrameRef.current}
          hitFrame={hitFrameRef.current}
          jumpFrame={jumpFrameRef.current}
          dashFrame={dashFrameRef.current}
          facing={facing.current}
          spriteScale={spriteScale}
          bodyW={bodyW}
          heroHp={heroHpRef.current}
          heroHpMax={heroCombat.baseHp}
          heroIFramesLeft={heroIFramesLeftRef.current}
          enemies={enemiesRef.current}
          dummies={dummies}
          dmgFloats={dmgFloats}
          devShowAttackHitbox={devShowAttackHitbox}
          attackingNow={attackingNow}
          debugHitX={debugHitX}
          debugHitY={debugHitY}
          actionArcRight={actionArcRight}
          safeInsets={safeInsets}
          controlsLive={controlsLive}
          dashReady={dashReady}
          dashCooldownProgress={dashCooldownProgress}
          dashCooldownSecondsLeft={dashCooldownSecondsLeft}
          controlLabels={controlLabels}
          joyRef={joyRef}
          onHitTap={() => {
            hitQueued.current = true;
          }}
          onDashTap={() => {
            dashQueued.current = true;
          }}
          onJumpTap={() => {
            jumpQueued.current = true;
          }}
          showPreMatchOverlay={showPreMatchOverlay}
          preMatchCeil={preMatchCeil}
          preMatchLabel={t('brawlerMatch.preMatchLabel')}
          showMatchOverOverlay={gameOverOpen && !postGameActive}
          gameOverTitle={t('brawlerMatch.gameOverTitle')}
          gameOverHint={t('brawlerMatch.gameOverHint')}
          gameOverReplayLabel={t('brawlerMatch.gameOverReplay')}
          gameOverExitLabel={t('brawlerMatch.gameOverExit')}
          showHeroDeadOverlay={deathChoiceOpen && !postGameActive && !gameOverOpen}
          heroDeadTitle={t('brawlerMatch.heroDeadTitle')}
          heroDeadBody={t('brawlerMatch.heroDeadBody')}
          heroDeadLeaveLabel={t('brawlerMatch.heroDeadLeave')}
          heroDeadSpectateLabel={t('brawlerMatch.heroDeadSpectate')}
          onLeaveToLobbyAfterDeath={handleLeaveToLobbyAfterDeath}
          onSpectateAfterDeath={handleSpectateAfterDeath}
          isSpectating={isSpectating}
          spectatingLabel={t('brawlerMatch.spectating')}
          spectatingPanHint={t('brawlerMatch.spectatingPanHint')}
          arenaAnnounce={arenaAnnounce}
          onArenaAnnounceDone={clearArenaAnnounce}
          showHeroStatsHud={showHeroStatsHud}
          heroStatRows={heroStatRows}
          onReplay={resetArenaRound}
          onExit={() => {
            navigation.replace('BrawlerLobby', { venueId: route.params.venueId });
          }}
        />

        <View style={[styles.hudOverlay, { top: safeInsets.top }]}>
          <ArenaHud
            styles={styles}
            safeInsets={safeInsets}
            showKdHud={showKdHud}
            kills={playerKillsRef.current}
            deaths={playerDeathsRef.current}
            showHudMatchClock={showHudMatchClock}
            phaseLabel={phaseShown}
            matchClockSeconds={matchRemainingShown}
            sessionId={sessionId}
            onToggleDev={() => setDevOpen((o) => !o)}
            resetLabel={sessionId ? t('brawlerMatch.hudLobby') : t('brawlerMatch.hudReset')}
            onReset={resetArenaRound}
            onExit={requestExitFromHud}
          />
        </View>
      </View>

      {!sessionId && devOpen ? (
        <ArenaDevPanel
          styles={styles}
          devMatchTimerEnabled={devMatchTimerEnabled}
          devEnemiesEnabled={devEnemiesEnabled}
          devEnemyCount={devEnemyCount}
          devDummiesEnabled={devDummiesEnabled}
          devDummyCount={devDummyCount}
          devShowAttackHitbox={devShowAttackHitbox}
          onMatchTimerPress={() => {
            setDevMatchTimerEnabled((v) => !v);
            preMatchLeftRef.current = !devMatchTimerEnabled ? PRE_MATCH_COUNTDOWN_S : 0;
            matchClockRef.current = matchMaxSRef.current;
            matchEndedRef.current = false;
            setGameOverOpen(false);
            bump();
          }}
          onEnemiesPress={() => {
            setDevEnemiesEnabled((v) => !v);
            if (!devEnemiesEnabled) syncEnemyCount(devEnemyCount);
            else enemiesRef.current = [];
            bump();
          }}
          onEnemyDecrement={() => {
            const next = Math.max(0, devEnemyCount - 1);
            setDevEnemyCount(next);
            if (devEnemiesEnabled) syncEnemyCount(next);
            bump();
          }}
          onEnemyIncrement={() => {
            const next = Math.min(6, devEnemyCount + 1);
            setDevEnemyCount(next);
            if (devEnemiesEnabled) syncEnemyCount(next);
            bump();
          }}
          onDummiesPress={() => {
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
          onDummyDecrement={() => {
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
          onDummyIncrement={() => {
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
          onHitboxDebugPress={() => setDevShowAttackHitbox((v) => !v)}
        />
      ) : null}

      {venueTwoHumanHold ? (
        <ArenaVenuePvpHoldOverlay
          styles={styles}
          title={t('brawlerMatch.pvpPlaceholderTitle')}
          body={t('brawlerMatch.pvpPlaceholderBody')}
          buttonLabel={t('brawlerMatch.backToLobby')}
          onLeave={() => {
            void abandonVenueTwoHumanAndLeave();
          }}
        />
      ) : null}

      {postGameActive && postGamePayload ? (
        <PostGameCarouselModal
          colors={colors}
          variant="overlay"
          visible
          payload={postGamePayload}
          actions={{ onDone: completeBrawlerPostGame }}
          onClose={dismissBrawlerPostGame}
          onComplete={completeBrawlerPostGame}
        />
      ) : null}
    </View>
  );
}
