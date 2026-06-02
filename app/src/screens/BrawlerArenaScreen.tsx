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
  DEFAULT_MATCH_PHASE_CHAOS_END_S,
  DEFAULT_MATCH_PHASE_ENDGAME_END_S,
  DEFAULT_MATCH_MAX_S,
  DEFAULT_MATCH_TIMER_ENABLED,
  DEFAULT_SHOW_ATTACK_HITBOX_DEBUG,
  GROUND_STRIP_H,
  MARGIN_SCREEN,
  PRE_MATCH_COUNTDOWN_S,
} from '../brawler/arena/constants';
import { arenaHeroCombat, matchPhaseLabelDyn } from '../brawler/arena/combat';
import { ArenaDevPanel } from '../brawler/arena/components/ArenaDevPanel';
import { ArenaHud } from '../brawler/arena/components/ArenaHud';
import {
  ArenaResultsOverlay,
  ArenaVenuePvpHoldOverlay,
} from '../brawler/arena/components/ArenaOverlays';
import { ArenaWorldView } from '../brawler/arena/components/ArenaWorldView';
import {
  spawnDummiesRandomOnPlatforms as spawnDummiesImpl,
  spawnEnemyOnRandomPlatform as spawnEnemyImpl,
  syncEnemyCount as syncEnemyCountImpl,
} from '../brawler/arena/spawn';
import { createArenaStyles } from '../brawler/arena/styles';
import type {
  ActiveBuff,
  BrawlerPowerupDef,
  BrawlerResultsScoreRow,
  Dummy,
  DmgFloat,
  Enemy,
  SpawnedPowerup,
  TrackedParticipant,
} from '../brawler/arena/types';
import { useArenaGameLoop } from '../brawler/arena/useArenaGameLoop';
import {
  ATTACK_HIT_FORWARD,
  ATTACK_HIT_H,
  ATTACK_HIT_W,
  ATTACK_HIT_Y_FROM_TOP,
} from '../brawler/arena/constants';
import { getHeroSpriteConfig, isArenaSpriteHero } from '../brawler/heroSpritesheets';
import type { RootStackParamList } from '../navigation/type';
import { apiGet, apiPost } from '../lib/api';
import type { MeSummaryDto } from '../lib/meSummary';
import { useVenueActivePlayBudgetSync } from '../lib/useVenueActivePlayBudgetSync';
import VenuePlayTimeBar from '../components/VenuePlayTimeBar';
import { previewBrawlerWinXp } from '../lib/brawlerWinXp';
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
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const s = await apiGet<MeSummaryDto>('/players/me/summary', token);
        if (!cancelled) setSubscriptionActive(Boolean(s.subscriptionActive));
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
  /** Venue 1v1 queue: two humans, no bot — real-time PvP not wired yet; gate gameplay and show notice. */
  const [venueTwoHumanHold, setVenueTwoHumanHold] = useState(false);
  const venueTwoHumanHoldRef = useRef(false);
  const [trackedSessionReady, setTrackedSessionReady] = useState(!sessionId);
  /** Same tick as session fetch success — avoids RAF running before React commits `setTrackedSessionReady`. */
  const trackedSessionGateRef = useRef(!sessionId);
  /** Same tick as session sets `setDevMatchTimerEnabled(true)` — avoids RAF before `devMatchTimerLiveRef` updates. */
  const pendingMatchTimerFromSessionRef = useRef(false);

  useVenueActivePlayBudgetSync({
    getToken: () => getTokenRef.current(),
    venueId: routeVenueId ?? null,
    subscriptionActive,
    kind: 'brawler',
    gameSessionId: sessionId,
    enabled: Boolean(routeVenueId && sessionId && !subscriptionActive && trackedSessionReady),
    onBudgetExhausted: () => {
      Alert.alert(t('brawlerMatch.playTimeExhaustedTitle'), t('brawlerMatch.playTimeExhaustedBody'), [
        { text: 'OK', onPress: () => navigationRef.current.replace('Home') },
      ]);
    },
  });
  const [resultsOverlay, setResultsOverlay] = useState<{
    title: string;
    scoreboard: BrawlerResultsScoreRow[];
  } | null>(null);

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
  /** Solo + ranked: enemy kills from attack hitbox or dash hit (finalize → DB only with `sessionId`). */
  const playerKillsRef = useRef(0);
  /** Solo + ranked: hero HP reaches 0 from contact damage (finalize sends to DB only when `sessionId`). */
  const playerDeathsRef = useRef(0);

  const enemiesRef = useRef<Enemy[]>([]);


  const dmgFloatsRef = useRef<DmgFloat[]>([]);
  const dmgFloatIdRef = useRef(1);

  const spriteScale = heroSprite?.displayScale ?? 1.65 * 0.75;
  const bodyW = (heroSprite?.framePx.w ?? 64) * spriteScale;
  const bodyH = (heroSprite?.framePx.h ?? 64) * spriteScale;

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

  // Used to explicitly allow simultaneous recognition between joystick pan + action taps.
  const [joystickGesture, setJoystickGesture] = useState<unknown | null>(null);

  const powerupDefsRef = useRef<BrawlerPowerupDef[]>([]);
  const powerupsOnMapRef = useRef<SpawnedPowerup[]>([]);
  const powerupSpawnAccumRef = useRef(0);
  const powerupPickedPendingRef = useRef<Set<string>>(new Set());

  const activeBuffsRef = useRef<
    Array<{
      powerupId: string;
      effectType: BrawlerPowerupDef['effectType'];
      magnitude: number;
      startedAtMs: number;
      endsAtMs: number;
    }>
  >([]);

  const attackTimeLeft = useRef(0);
  const dashTimeLeft = useRef(0);
  const dashCooldownLeft = useRef(0);
  const hitFrameRef = useRef(0);
  const dashHitAppliedRef = useRef(false);

  const [, setRenderTick] = useState(0);
  const spriteAnimRef = useRef<HeroSpriteAnim>('idle');
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
        const humanOnly = parts.filter((p) => p.playerId && !p.isBot);
        const hasBot = parts.some((p) => p.isBot);
        if (humanOnly.length === 2 && !hasBot) {
          venueTwoHumanHoldRef.current = true;
          setVenueTwoHumanHold(true);
          trackedSessionGateRef.current = false;
          setTrackedSessionReady(false);
          return;
        }
        venueTwoHumanHoldRef.current = false;
        setVenueTwoHumanHold(false);
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
        matchClockRef.current = 0;
        matchEndedRef.current = false;
        setGameOverOpen(false);
        setHeroDeadOpen(false);
        finalizeStartedRef.current = false;
        setTrackedSessionReady(true);
        playerKillsRef.current = 0;
        playerDeathsRef.current = 0;
        powerupsOnMapRef.current = [];
        powerupSpawnAccumRef.current = 0;
        powerupPickedPendingRef.current = new Set();
        activeBuffsRef.current = [];
        bump();
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Session', (e as Error).message || 'Failed to load brawler session');
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
    if (!sessionId || venueTwoHumanHold) return;
    if (!gameOverOpen && !heroDeadOpen) return;
    if (finalizeStartedRef.current) return;
    finalizeStartedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const human = participantsRef.current.find((p) => !p.isBot);
        const bot = participantsRef.current.find((p) => p.isBot);
        const humanAlive = heroHpRef.current > 0;
        let winnerId: string | undefined;
        if (heroDeadOpen) {
          winnerId = bot?.id ?? human?.id;
        } else if (gameOverOpen) {
          winnerId = humanAlive ? human?.id : bot?.id ?? human?.id;
        }
        const participantsPayload = participantsRef.current.map((p) => ({
          participantId: p.id,
          placement: p.id === winnerId ? 1 : 2,
          score: 0,
          result: (p.id === winnerId ? 'WIN' : 'LOSS') as 'WIN' | 'LOSS',
          kills: p.isBot ? 0 : playerKillsRef.current,
          deaths: p.isBot ? 0 : playerDeathsRef.current,
        }));
        await apiPost(
          `/brawler/sessions/${encodeURIComponent(sessionId)}/finalize`,
          {
            winnerParticipantId: winnerId,
            participants: participantsPayload,
            ...(typeof brawlerSnapshotRevRef.current === 'number'
              ? { ifSnapshotRev: brawlerSnapshotRevRef.current }
              : {}),
          },
          token,
        );
        if (cancelled) return;
        const labelFor = (p: TrackedParticipant) => {
          if (p.isBot) return p.botName ?? 'Bot';
          return p.displayNameSnapshot ?? 'You';
        };
        const venueScoped = Boolean(route.params.venueId);
        const sortedPayload = [...participantsPayload].sort(
          (a, b) => (a.placement ?? 99) - (b.placement ?? 99),
        );
        const scoreboard: BrawlerResultsScoreRow[] = sortedPayload.map((row) => {
          const p = participantsRef.current.find((x) => x.id === row.participantId);
          const name = p ? labelFor(p) : row.participantId;
          const kills = row.kills ?? 0;
          const deaths = row.deaths ?? 0;
          const won = row.result === 'WIN';
          let xpGained = 0;
          if (won && p && !p.isBot) {
            xpGained = previewBrawlerWinXp(venueScoped, kills, deaths);
          }
          return {
            name,
            kills,
            deaths,
            xpGained,
            resultLabel: row.result,
          };
        });
        setResultsOverlay({ title: 'Match results', scoreboard });
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Finalize failed', (e as Error).message || 'Unknown error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, venueTwoHumanHold, gameOverOpen, heroDeadOpen, route.params.venueId]);

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
    playerKillsRef.current = 0;
    playerDeathsRef.current = 0;

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
    sessionId,
    navigation,
    route.params.venueId,
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
    ? (heroSprite?.hitFineOffsetSheetPx[facing.current] ?? 0)
    : 0;
  const hitDrawOffsetX =
    ((heroSprite?.hitAnchorOffsetX ?? 0) + hitFineSheetPx) * spriteScale;

  const dashReady = dashCooldownLeft.current <= 0 && dashTimeLeft.current <= 0;

  const arenaReadyHud = arenaW >= 32 && arenaInnerH >= 32;
  const controlsLive = devMatchTimerEnabled
    ? arenaReadyHud &&
      preMatchLeftRef.current <= 0 &&
      !matchEndedRef.current &&
      !heroDeadOpen
    : arenaReadyHud && !heroDeadOpen;

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
    devMatchTimerEnabled,
    sessionId,
    controlsLive,
    difficultyTuning,
    bump,
    spawnEnemyOnRandomPlatform,
    setGameOverOpen,
    setHeroDeadOpen,
    arenaWLiveRef,
    arenaInnerHLiveRef,
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
    powerupPickedPendingRef,
    activeBuffsRef,
    participantsRef,
    getTokenRef,
    dashCooldownLeft,
    dashTimeLeft,
    attackTimeLeft,
    hitFrameRef,
    dashHitAppliedRef,
    spriteAnimRef,
    walkFrameRef,
    walkAccum,
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
  const matchClockShown = matchClockRef.current;
  const phaseShown = matchPhaseLabelDyn(
    matchClockShown,
    matchChaosEndSRef.current,
    matchEndgameEndSRef.current,
  );

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
    if (venueTwoHumanHoldRef.current) {
      void abandonVenueTwoHumanAndLeave();
      return;
    }
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
  }, [abandonVenueTwoHumanAndLeave, gameOverOpen, navigation]);

  const dummies = dummiesRef.current;
  const debugHitW = ATTACK_HIT_W;
  const debugHitH = ATTACK_HIT_H;
  const debugHitY = playerY.current + ATTACK_HIT_Y_FROM_TOP;
  const debugHitX =
    facing.current === 'right'
      ? playerX.current + bodyW + ATTACK_HIT_FORWARD
      : playerX.current - debugHitW - ATTACK_HIT_FORWARD;

  const dmgFloats = dmgFloatsRef.current;

  const showKdHud = arenaReadyHud && !resultsOverlay && !venueTwoHumanHold;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ArenaHud
        styles={styles}
        heroHp={heroHpRef.current}
        heroHpMax={heroCombat.baseHp}
        heroIFramesLeft={heroIFramesLeftRef.current}
        showKdHud={showKdHud}
        kills={playerKillsRef.current}
        deaths={playerDeathsRef.current}
        showHudMatchClock={showHudMatchClock}
        phaseLabel={phaseShown}
        matchClockSeconds={matchClockShown}
        sessionId={sessionId}
        onToggleDev={() => setDevOpen((o) => !o)}
        resetLabel={sessionId ? 'Lobby' : 'Reset'}
        onReset={resetArenaRound}
        onExit={requestExitFromHud}
      />

      {routeVenueId ? (
        <VenuePlayTimeBar
          venueId={routeVenueId}
          getToken={() => getTokenRef.current()}
          subscriptionActive={subscriptionActive}
        />
      ) : null}

      <View style={styles.arenaFlex}>
        <ArenaWorldView
          styles={styles}
          onArenaLayout={onArenaLayout}
          worldW={worldW}
          worldH={worldH}
          arenaW={arenaW}
          arenaInnerH={arenaInnerH}
          camX={camX}
          camY={camY}
          skyW={skyW}
          skyH={skyH}
          skyLeft={skyLeft}
          skyTop={skyTop}
          platformsWorld={platformsWorld}
          powerups={powerupsOnMapRef.current}
          px={px}
          py={py}
          hitDrawOffsetX={hitDrawOffsetX}
          heroSprite={heroSprite}
          spriteAnim={spriteAnimRef.current}
          walkFrame={walkFrameRef.current}
          hitFrame={hitFrameRef.current}
          facing={facing.current}
          spriteScale={spriteScale}
          enemies={enemiesRef.current}
          dummies={dummies}
          dmgFloats={dmgFloats}
          devShowAttackHitbox={devShowAttackHitbox}
          attackingNow={attackingNow}
          debugHitX={debugHitX}
          debugHitY={debugHitY}
          bottomPad={bottomPad}
          actionArcRight={actionArcRight}
          controlsLive={controlsLive}
          dashReady={dashReady}
          joystickGesture={joystickGesture}
          joyRef={joyRef}
          onJoystickGestureReady={setJoystickGesture}
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
          showMatchOverOverlay={gameOverOpen}
          showHeroDeadOverlay={heroDeadOpen}
          onReplay={resetArenaRound}
          onExit={() => navigation.goBack()}
        />
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
            matchClockRef.current = 0;
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

      {resultsOverlay ? (
        <ArenaResultsOverlay
          styles={styles}
          title={resultsOverlay.title}
          scoreboard={resultsOverlay.scoreboard}
          onBackToLobby={() => {
            setResultsOverlay(null);
            navigation.replace('BrawlerLobby', {
              venueId: route.params.venueId,
            });
          }}
        />
      ) : null}
    </View>
  );
}
