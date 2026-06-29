import { useEffect, type MutableRefObject } from 'react';
import type { HeroSpriteAnim } from '../../components/HeroSpriteView';
import {
  getAttackFrameCount,
  getAttackHitFromTopPx,
  getDashFrameCount,
  getIdleFrameCount,
  getJumpFrameCount,
  getPickupCenter,
  getWalkFrameCount,
} from '../heroSpriteUtils';
import { apiPost } from '../../lib/api';
import {
  HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
  HERO_FEET_EMBED_GROUND_PLATFORM_PX,
  spawnOnBottomPlatform,
  type PlatformWorld,
} from '../arenaPlatforms';
import { computeLavaSurfaceY, matchPhaseMods } from './combat';
import { aabbOverlap, overlapX } from './collision';
import {
  ATTACK_DURATION_S,
  ATTACK_HIT_FORWARD,
  ATTACK_HIT_H,
  ATTACK_HIT_W,
  DASH_DURATION_S,
  DASH_SPEED,
  DMG_FLOAT_LIFETIME_S,
  DUMMY_HP_MAX,
  DUMMY_RESPAWN_DELAY_S,
  ENEMY_HP_MAX,
  ENEMY_IFRAMES_S,
  ENEMY_RESPAWN_DELAY_S,
  GROUND_STRIP_H,
  GRAVITY,
  HERO_IFRAMES_S,
  JUMP_VELOCITY,
  MARGIN_SCREEN,
  POWERUP_MAX_ON_MAP,
  POWERUP_PICKUP_RADIUS_PX,
  POWERUP_SPAWN_INTERVAL_S,
  IDLE_FRAME_MS,
  WALK_FRAME_MS,
} from './constants';
import type {
  ActiveBuff,
  BrawlerPowerupDef,
  Dummy,
  DmgFloat,
  Enemy,
  SpawnedPowerup,
  TrackedParticipant,
} from './types';
import type { arenaHeroCombat } from './combat';
import { pickRandomPowerupSpawnPosition } from './powerupSpawn';

export type ArenaGameLoopConfig = {
  arenaW: number;
  arenaInnerH: number;
  worldW: number;
  worldH: number;
  bodyW: number;
  bodyH: number;
  floorY: number;
  FEET_W: number;
  heroCombat: ReturnType<typeof arenaHeroCombat>;
  heroDeadOpen: boolean;
  isSpectatingRef: MutableRefObject<boolean>;
  devMatchTimerEnabled: boolean;
  sessionId: string | undefined;
  controlsLive: boolean;
  difficultyTuning: { enemySpeedMul: number; contactDmg: number };
  bump: () => void;
  spawnEnemyOnRandomPlatform: () => Enemy;
  setGameOverOpen: (open: boolean) => void;
  setHeroDeadOpen: (open: boolean) => void;
  arenaWLiveRef: MutableRefObject<number>;
  arenaInnerHLiveRef: MutableRefObject<number>;
  worldWLiveRef: MutableRefObject<number>;
  worldHLiveRef: MutableRefObject<number>;
  sessionIdLiveRef: MutableRefObject<string | undefined>;
  trackedSessionGateRef: MutableRefObject<boolean>;
  devMatchTimerLiveRef: MutableRefObject<boolean>;
  pendingMatchTimerFromSessionRef: MutableRefObject<boolean>;
  matchChaosEndSRef: MutableRefObject<number>;
  matchEndgameEndSRef: MutableRefObject<number>;
  matchMaxSRef: MutableRefObject<number>;
  preMatchLeftRef: MutableRefObject<number>;
  matchClockRef: MutableRefObject<number>;
  matchEndedRef: MutableRefObject<boolean>;
  platformsRef: MutableRefObject<PlatformWorld[]>;
  playerX: MutableRefObject<number>;
  playerY: MutableRefObject<number>;
  prevPlayerY: MutableRefObject<number>;
  vx: MutableRefObject<number>;
  vy: MutableRefObject<number>;
  onGround: MutableRefObject<boolean>;
  facing: MutableRefObject<'left' | 'right'>;
  joyRef: MutableRefObject<{ x: number; y: number }>;
  jumpQueued: MutableRefObject<boolean>;
  hitQueued: MutableRefObject<boolean>;
  dashQueued: MutableRefObject<boolean>;
  hitAppliedThisSwing: MutableRefObject<boolean>;
  heroHpRef: MutableRefObject<number>;
  heroIFramesLeftRef: MutableRefObject<number>;
  playerKillsRef: MutableRefObject<number>;
  playerDeathsRef: MutableRefObject<number>;
  dummiesRef: MutableRefObject<Dummy[]>;
  enemiesRef: MutableRefObject<Enemy[]>;
  dmgFloatsRef: MutableRefObject<DmgFloat[]>;
  dmgFloatIdRef: MutableRefObject<number>;
  powerupDefsRef: MutableRefObject<BrawlerPowerupDef[]>;
  powerupsOnMapRef: MutableRefObject<SpawnedPowerup[]>;
  powerupSpawnAccumRef: MutableRefObject<number>;
  arenaServerTickAccumRef: MutableRefObject<number>;
  powerupPickedPendingRef: MutableRefObject<Set<string>>;
  activeBuffsRef: MutableRefObject<ActiveBuff[]>;
  powerupPickupFlashRef: MutableRefObject<{
    displayName: string;
    effectType: ActiveBuff['effectType'];
    endsAtMs: number;
  } | null>;
  participantsRef: MutableRefObject<TrackedParticipant[]>;
  getTokenRef: MutableRefObject<() => Promise<string | null>>;
  dashCooldownLeft: MutableRefObject<number>;
  dashTimeLeft: MutableRefObject<number>;
  attackTimeLeft: MutableRefObject<number>;
  hitFrameRef: MutableRefObject<number>;
  jumpFrameRef: MutableRefObject<number>;
  dashFrameRef: MutableRefObject<number>;
  dashHitAppliedRef: MutableRefObject<boolean>;
  spriteAnimRef: MutableRefObject<HeroSpriteAnim>;
  walkFrameRef: MutableRefObject<number>;
  walkAccum: MutableRefObject<number>;
  idleFrameRef: MutableRefObject<number>;
  idleAccum: MutableRefObject<number>;
  heroSpriteLiveRef: MutableRefObject<
    import('../heroSpriteTypes').HeroSpriteConfig | undefined
  >;
};

export function useArenaGameLoop(config: ArenaGameLoopConfig) {
  const {
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
    controlsLive,
    difficultyTuning,
    bump,
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
  } = config;

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

      const arenaReady =
        arenaWLiveRef.current >= 32 && arenaInnerHLiveRef.current >= 32;

      if (sessionIdLiveRef.current && !trackedSessionGateRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const matchTimerOn =
        devMatchTimerLiveRef.current || pendingMatchTimerFromSessionRef.current;

      if (arenaReady && matchTimerOn && preMatchLeftRef.current > 0) {
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

      if (arenaReady && matchTimerOn && preMatchLeftRef.current <= 0) {
        if (!matchEndedRef.current) {
          matchClockRef.current = Math.min(
            matchMaxSRef.current,
            matchClockRef.current + dt,
          );
          if (matchClockRef.current >= matchMaxSRef.current) {
            matchEndedRef.current = true;
            setGameOverOpen(true);
          }
        }
      }

      if (
        arenaReady &&
        matchTimerOn &&
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

      // Hero death: freeze until the player chooses to spectate.
      if (heroDeadOpen && !isSpectatingRef.current) {
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

      const phaseMods = matchPhaseMods(
        matchClockRef.current,
        matchChaosEndSRef.current,
        matchEndgameEndSRef.current,
      );

      const nowMs = Math.floor(matchClockRef.current * 1000);

      // Power-ups: expire local buff state (server remains source of truth for pickups).
      if (activeBuffsRef.current.length > 0) {
        const before = activeBuffsRef.current.length;
        activeBuffsRef.current = activeBuffsRef.current.filter((b) => b.endsAtMs > nowMs);
        if (activeBuffsRef.current.length !== before) bump();
      }

      const pickupFlash = powerupPickupFlashRef.current;
      if (pickupFlash && pickupFlash.endsAtMs <= nowMs) {
        powerupPickupFlashRef.current = null;
        bump();
      }

      const useServerArena = Boolean(sessionIdLiveRef.current);

      // Power-ups: server-authoritative spawns when in a tracked session.
      if (
        useServerArena &&
        controlsLive &&
        arenaReady &&
        powerupDefsRef.current.length > 0
      ) {
          arenaServerTickAccumRef.current += dt;
        if (arenaServerTickAccumRef.current >= 1) {
          arenaServerTickAccumRef.current = 0;
          const sid = sessionIdLiveRef.current!;
          const tickWorldW = Math.round(worldWLiveRef.current);
          const tickWorldH = Math.round(worldHLiveRef.current);
          if (tickWorldW < 100 || tickWorldH < 100) {
            /* wait for arena layout before server spawns */
          } else {
            void (async () => {
              try {
                const token = await getTokenRef.current();
                if (!token) return;
                const res = await apiPost<{
                  spawned: boolean;
                  spawn?: {
                    spawnId: string;
                    powerupId: string;
                    x: number;
                    y: number;
                    r?: number;
                  };
                }>(
                  `/brawler/sessions/${encodeURIComponent(sid)}/arena/tick`,
                  {
                    atMs: nowMs,
                    worldW: tickWorldW,
                    worldH: tickWorldH,
                  },
                  token,
                );
                if (
                  res.spawned &&
                  res.spawn &&
                  !powerupsOnMapRef.current.some((p) => p.spawnId === res.spawn!.spawnId)
                ) {
                  powerupsOnMapRef.current = [
                    ...powerupsOnMapRef.current,
                    {
                      spawnId: res.spawn.spawnId,
                      powerupId: res.spawn.powerupId,
                      x: res.spawn.x,
                      y: res.spawn.y,
                      r: res.spawn.r ?? POWERUP_PICKUP_RADIUS_PX,
                    },
                  ];
                  bump();
                }
              } catch {
                /* socket / next tick will reconcile */
              }
            })();
          }
        }
      } else if (
        controlsLive &&
        arenaReady &&
        powerupDefsRef.current.length > 0 &&
        powerupsOnMapRef.current.length < POWERUP_MAX_ON_MAP
      ) {
        // Dev / offline arena: local spawns.
        powerupSpawnAccumRef.current += dt;
        if (powerupSpawnAccumRef.current >= POWERUP_SPAWN_INTERVAL_S) {
          powerupSpawnAccumRef.current = 0;
          const defs = powerupDefsRef.current;
          const totalW = defs.reduce((acc, d) => acc + Math.max(0, d.spawnWeight || 0), 0);
          let pick = defs[0]!;
          if (totalW > 0) {
            let r = Math.random() * totalW;
            for (const d of defs) {
              r -= Math.max(0, d.spawnWeight || 0);
              if (r <= 0) {
                pick = d;
                break;
              }
            }
          }

          const pos = pickRandomPowerupSpawnPosition(worldW, worldH);
          if (pos) {
            const spawnId = `${nowMs}-${Math.floor(Math.random() * 1e9)}`;
            powerupsOnMapRef.current = [
              ...powerupsOnMapRef.current,
              {
                spawnId,
                powerupId: pick.id,
                x: pos.x,
                y: pos.y,
                r: POWERUP_PICKUP_RADIUS_PX,
              },
            ];
            bump();
          }
        }
      }

      // Power-ups: pickup check (hero center vs pickup). Auto-apply via server endpoint.
      if (
        controlsLive &&
        sessionIdLiveRef.current &&
        powerupsOnMapRef.current.length > 0 &&
        participantsRef.current.length > 0
      ) {
        const human = participantsRef.current.find((p) => !p.isBot);
        if (human) {
          const { hx, hy } = getPickupCenter(
            heroSpriteLiveRef.current,
            playerX.current,
            playerY.current,
            bodyW,
            bodyH,
          );
          const pending = powerupPickedPendingRef.current;
          for (const pu of powerupsOnMapRef.current) {
            if (pending.has(pu.spawnId)) continue;
            if (Math.hypot(hx - pu.x, hy - pu.y) > pu.r) continue;
            pending.add(pu.spawnId);

            const def = powerupDefsRef.current.find((d) => d.id === pu.powerupId);
            powerupsOnMapRef.current = powerupsOnMapRef.current.filter(
              (p) => p.spawnId !== pu.spawnId,
            );
            if (def) {
              const ends = nowMs + def.durationMs;
              const buffs = activeBuffsRef.current;
              const idx = buffs.findIndex((b) => b.powerupId === pu.powerupId);
              const next: ActiveBuff = {
                powerupId: pu.powerupId,
                effectType: def.effectType,
                magnitude: def.magnitude,
                startedAtMs: nowMs,
                endsAtMs: ends,
              };
              activeBuffsRef.current =
                idx >= 0 ? buffs.map((b, i) => (i === idx ? next : b)) : [...buffs, next];
              powerupPickupFlashRef.current = {
                displayName: def.displayName,
                effectType: def.effectType,
                endsAtMs: nowMs + 2200,
              };
            }
            bump();

            void (async () => {
              try {
                const token = await getTokenRef.current();
                if (!token) throw new Error('Not authenticated');
                const res = await apiPost<{
                  applied: boolean;
                  reason?: string;
                  spawnId: string;
                  powerupId?: string;
                  effectType?: BrawlerPowerupDef['effectType'];
                  magnitude?: number;
                  startedAtMs?: number;
                  endsAtMs?: number;
                }>(
                  `/brawler/sessions/${encodeURIComponent(sessionIdLiveRef.current!)}/powerups/pick`,
                  {
                    atMs: nowMs,
                    actorParticipantId: human.id,
                    spawnId: pu.spawnId,
                    powerupId: pu.powerupId,
                    x: Math.round(pu.x),
                    y: Math.round(pu.y),
                  },
                  token,
                );

                if (
                  res.applied &&
                  res.effectType &&
                  typeof res.magnitude === 'number' &&
                  def
                ) {
                  const started =
                    typeof res.startedAtMs === 'number' ? res.startedAtMs : nowMs;
                  const ends = typeof res.endsAtMs === 'number' ? res.endsAtMs : nowMs + 5000;
                  const buffs = activeBuffsRef.current;
                  const idx = buffs.findIndex((b) => b.powerupId === pu.powerupId);
                  const next: ActiveBuff = {
                    powerupId: pu.powerupId,
                    effectType: res.effectType,
                    magnitude: res.magnitude,
                    startedAtMs: started,
                    endsAtMs: ends,
                  };
                  activeBuffsRef.current =
                    idx >= 0 ? buffs.map((b, i) => (i === idx ? next : b)) : [...buffs, next];
                }
              } catch {
                // allow retry; optimistic state stays until socket/refresh reconciles
              } finally {
                powerupPickedPendingRef.current.delete(pu.spawnId);
                bump();
              }
            })();
            break;
          }
        }
      }

      dashCooldownLeft.current = Math.max(0, dashCooldownLeft.current - dt);

      const wasDashing = dashTimeLeft.current > 0;
      dashTimeLeft.current = Math.max(0, dashTimeLeft.current - dt);
      if (wasDashing && dashTimeLeft.current <= 0) {
        const dashCooldownMul = activeBuffsRef.current.reduce(
          (mul, b) =>
            b.endsAtMs > nowMs && b.effectType === 'DASH_COOLDOWN_MULT'
              ? mul * b.magnitude
              : mul,
          1,
        );
        dashCooldownLeft.current = heroCombat.dashCooldownS * dashCooldownMul;
      }

      attackTimeLeft.current = Math.max(0, attackTimeLeft.current - dt);

      if (attackTimeLeft.current > 0) {
        const cfg = heroSpriteLiveRef.current;
        const attackFrames = getAttackFrameCount(cfg);
        if (attackFrames > 1) {
          const elapsed = ATTACK_DURATION_S - attackTimeLeft.current;
          const t = Math.min(1, Math.max(0, elapsed / ATTACK_DURATION_S));
          hitFrameRef.current = Math.min(
            attackFrames - 1,
            Math.floor(t * attackFrames),
          );
        }
      }

      if (dashTimeLeft.current > 0) {
        const cfg = heroSpriteLiveRef.current;
        const dashFrames = getDashFrameCount(cfg);
        if (dashFrames > 1) {
          const elapsed = DASH_DURATION_S - dashTimeLeft.current;
          const t = Math.min(1, Math.max(0, elapsed / DASH_DURATION_S));
          dashFrameRef.current = Math.min(
            dashFrames - 1,
            Math.floor(t * dashFrames),
          );
        }
      } else {
        dashFrameRef.current = 0;
      }

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
                e.x += e.vx * phaseMods.enemySpeed * dt;
                if (e.x <= xMin) {
                  e.x = xMin;
                  e.vx = Math.abs(e.vx);
                } else if (e.x >= xMax) {
                  e.x = xMax;
                  e.vx = -Math.abs(e.vx);
                }
              } else {
                // Knockback can push it off the platform edge.
                e.x += (e.vx * phaseMods.enemySpeed + e.knockVx) * dt;
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
        dashFrameRef.current = 0;
        dashHitAppliedRef.current = false;
      }

      if (attackTimeLeft.current <= 0) {
        hitFrameRef.current = 0;
      }

      const dashing = dashTimeLeft.current > 0;
      const attacking = attackTimeLeft.current > 0;

      const buffsNow = activeBuffsRef.current;
      const moveSpeedMul = buffsNow.reduce(
        (mul, b) =>
          b.endsAtMs > nowMs && b.effectType === 'MOVE_SPEED_MULT'
            ? mul * b.magnitude
            : mul,
        1,
      );
      const attackMul = buffsNow.reduce(
        (mul, b) =>
          b.endsAtMs > nowMs && b.effectType === 'ATTACK_DMG_MULT'
            ? mul * b.magnitude
            : mul,
        1,
      );
      const jumpMul = buffsNow.reduce(
        (mul, b) =>
          b.endsAtMs > nowMs && b.effectType === 'JUMP_MULT' ? mul * b.magnitude : mul,
        1,
      );
      const dashSpeedMul = buffsNow.reduce(
        (mul, b) =>
          b.endsAtMs > nowMs && b.effectType === 'DASH_SPEED_MULT'
            ? mul * b.magnitude
            : mul,
        1,
      );

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
          const enemyHpBefore = hitEnemy.hp;
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
          if (hitEnemy.hp <= 0) {
            hitEnemy.respawnLeft = ENEMY_RESPAWN_DELAY_S;
            if (enemyHpBefore > 0) {
              playerKillsRef.current += 1;
            }
          }

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

          const hitY =
            playerY.current +
            getAttackHitFromTopPx(heroSpriteLiveRef.current);
          const hitX =
            facing.current === 'right'
              ? playerX.current + bodyW + ATTACK_HIT_FORWARD
              : playerX.current - hitW - ATTACK_HIT_FORWARD;

          const dmg = Math.max(1, Math.round(heroCombat.attackDamage * attackMul));

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
            const enemyHpBefore = hitEnemy.hp;
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
              if (enemyHpBefore > 0) {
                playerKillsRef.current += 1;
              }
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
        vx.current = dir * DASH_SPEED * dashSpeedMul;
      } else if (!attacking) {
        const jx = joyRef.current.x;
        if (Math.abs(jx) > 0.02) {
          vx.current = jx * heroCombat.moveSpeedPx * moveSpeedMul;
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
        vy.current = JUMP_VELOCITY * jumpMul;
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

      // Sudden-death lava: feet in lava = permanent death for this match.
      const lavaSurfaceY = computeLavaSurfaceY(
        matchClockRef.current,
        matchEndgameEndSRef.current,
        matchMaxSRef.current,
        worldHLiveRef.current,
      );
      if (lavaSurfaceY != null && heroHpRef.current > 0) {
        const feetBottom = playerY.current + bodyH;
        if (feetBottom >= lavaSurfaceY - 2) {
          const heroHpBefore = heroHpRef.current;
          heroHpRef.current = 0;
          if (heroHpBefore > 0) {
            playerDeathsRef.current += 1;
          }
          setHeroDeadOpen(true);
          bump();
        }
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
            const heroHpBefore = heroHpRef.current;
            heroHpRef.current = Math.max(
              0,
              heroHpRef.current -
                Math.round(difficultyTuning.contactDmg * phaseMods.contactDmg),
            );
            heroIFramesLeftRef.current = HERO_IFRAMES_S;
            // Light knockback away from enemy to make hits readable.
            const dir =
              playerX.current + bodyW / 2 < touchingEnemy.x + touchingEnemy.w / 2 ? -1 : 1;
            vx.current = dir * 220;
            if (heroHpRef.current <= 0) {
              if (heroHpBefore > 0) {
                playerDeathsRef.current += 1;
              }
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

      let nextAnim: HeroSpriteAnim = 'idle';
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
            (walkFrameRef.current + 1) %
            getWalkFrameCount(heroSpriteLiveRef.current);
        }
        idleAccum.current = 0;
      } else if (nextAnim === 'idle') {
        walkAccum.current = 0;
        jumpFrameRef.current = 0;
        const idleFrames = getIdleFrameCount(heroSpriteLiveRef.current);
        if (idleFrames > 1) {
          idleAccum.current += dt * 1000;
          if (idleAccum.current >= IDLE_FRAME_MS) {
            idleAccum.current %= IDLE_FRAME_MS;
            idleFrameRef.current =
              (idleFrameRef.current + 1) % idleFrames;
          }
        } else {
          idleAccum.current = 0;
        }
      } else if (nextAnim === 'jump') {
        walkAccum.current = 0;
        idleAccum.current = 0;
        const jumpFrames = getJumpFrameCount(heroSpriteLiveRef.current);
        if (jumpFrames > 1) {
          const fallVy = 640;
          const t = Math.min(
            1,
            Math.max(0, (vy.current - JUMP_VELOCITY) / (fallVy - JUMP_VELOCITY)),
          );
          jumpFrameRef.current = Math.min(
            jumpFrames - 1,
            Math.floor(t * jumpFrames),
          );
        }
      } else {
        walkAccum.current = 0;
        idleAccum.current = 0;
        if (nextAnim !== 'dash') {
          jumpFrameRef.current = 0;
        }
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
    isSpectatingRef,
    devMatchTimerEnabled,
    HERO_FEET_EMBED_GROUND_PLATFORM_PX,
    HERO_FEET_EMBED_FLOATING_PLATFORM_PX,
    sessionId,
    spawnEnemyOnRandomPlatform,
    difficultyTuning,
    controlsLive,
    FEET_W,
    setGameOverOpen,
    setHeroDeadOpen,
  ]);
}
