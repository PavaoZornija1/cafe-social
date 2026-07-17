# Authoritative Brawler Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship multi-pod-safe Redis game runtime, then authoritative Brawler combat (Nest bridge → dedicated worker), unlock PvP/ranked, and improve client render performance.

**Architecture:** Clients send inputs; Redis holds live combat/arena with CAS; Postgres holds durable sessions/results; Nest hosts tick bridge first; later extract game-worker. Spec: `docs/superpowers/specs/2026-07-17-authoritative-brawler-architecture-design.md`.

**Tech Stack:** NestJS, Redis (`compareAndSetJsonRev`), Socket.IO Redis adapter, Expo RN client, Jest.

## Global Constraints

- Fail-closed on Redis when multi-pod / production requires it — no silent memory authority.
- Local solo may use `GAME_RUNTIME_ALLOW_MEMORY=1` for arena/bot only; memory combat never for multi-human.
- Unlock ranked/2-human only after Phase 1 exit criteria.
- Keep imports at tops; exhaustive switches; TDD for policy and CAS paths.
- Do not commit unless user asks.

---

### Task 1: Phase 0 — Runtime Redis policy

**Files:**
- Create: `backend/src/redis/game-runtime-policy.ts`
- Create: `backend/src/redis/game-runtime-policy.spec.ts`
- Modify: `backend/src/redis/game-runtime-redis.service.ts`
- Modify: `backend/.env.example`
- Modify: `docs/STAGING_STACK.md` or README snippet if present

- [x] Add `allowMemoryGameRuntime(env)` and `requireRedisGameRuntime(env)` helpers.
- [x] Require Redis when `GAME_RUNTIME_REQUIRE_REDIS=1` or production without allow-memory.
- [x] Document `REDIS_URL`, `GAME_RUNTIME_REQUIRE_REDIS`, `GAME_RUNTIME_ALLOW_MEMORY`.

### Task 2: Phase 0 — Arena fail-closed

**Files:**
- Modify: `backend/src/brawler/brawler-arena-redis.service.ts`
- Modify: `backend/src/brawler/brawler-arena-redis.service.spec.ts`
- Modify: `backend/src/main.ts` (align Socket.IO warning / require)

- [x] When Redis enabled: never fall through to memory Map on write errors; throw ServiceUnavailable/Conflict.
- [x] When Redis disabled: memory only if allow-memory; else throw on arena read/write.
- [x] Stop treating successful Redis writes as needing memory mirror for authority (optional L1 cache OK only if Redis remains SoT on read).
- [x] Tests for fail-closed vs allow-memory paths.

### Task 3: Phase 1 — Combat Redis document + lock

**Files:**
- Create: `backend/src/brawler/brawler-combat.types.ts`
- Create: `backend/src/brawler/brawler-combat-redis.service.ts` (+spec)
- Extend: `game-runtime-redis.service.ts` with lock helpers if missing

- [x] Combat state V1 schema + CAS read/write.
- [x] Tick owner lock acquire/renew/release.
- [x] Init combat state when brawler match becomes ACTIVE.

### Task 4: Phase 1 — Tick loop + inputs + snapshots

**Files:**
- Create: `backend/src/brawler/brawler-combat-sim.service.ts` (+spec)
- Modify: `brawler.gateway.ts`, `brawler.controller.ts`, `brawler.service.ts`, DTOs
- Modify: app `useBrawlerSocket.ts`, `useArenaGameLoop.ts`, `BrawlerArenaScreen.tsx`

- [x] 20 Hz sim under lock; bot AI in tick owner.
- [x] Input endpoint/WS with membership + rate limit.
- [x] Emit combat snapshots; client reconciles; stop client-authoritative finalize.
- [x] Finalize from combat document.

### Task 5: Unlock PvP / ranked

**Files:**
- Modify: hold/rank gates in app + backend matchmaking

- [x] Remove 2-human hold and ranked blocks only after Phase 1 tests pass.
- [x] Integration coverage for two humans + winner agreement.

### Task 6: Phase 3 — Client render rewrite

**Files:**
- `useArenaGameLoop.ts`, arena views

- [x] Eliminate per-frame full React re-renders; HUD-only bumps.

### Task 7: Phase 2 — Game worker extract (**DEFERRED**)

> **Status (2026-07-18):** Do **not** implement yet. Nest still hosts the combat tick (Phase 1 bridge). Revisit when multi-pod production load or tick latency becomes a real ops concern.

**What it is:** A second backend **process** (same monorepo, e.g. `npm run start:game-worker`), not a second product or mobile app. Players still only talk to Nest; the worker never serves HTTP/CMS.

**Why do this separately later:**
1. **Scale independently** — API (auth, CMS, REST) and simulation (20 Hz ticks) have different load shapes; one spike shouldn’t stall the other.
2. **Isolation** — A worker crash/restart can fail over via Redis tick locks without taking down the whole API.
3. **Cleaner Nest** — Gateway stays auth / matchmaking / WS fan-out; combat ownership lives in one place.
4. **Same protocols** — Reuse existing Redis combat/arena keys + CAS; no client rewrite if Phase 1 schemas stay stable.

**When to pick it up:** Multiple API pods + Redis in prod, active PvP load, or measurable tick jitter under API traffic.

**Files (when implementing):**
- New entrypoint `backend/src/game-worker` (or package)
- Env: disable Nest-hosted tick when worker is up (`GAME_RUNTIME_TICK_OWNER=worker` or similar)
- Deploy docs (API Deployment + game-worker Deployment, shared Redis + Postgres)

- [ ] Move tick owner out of API pods; Nest remains gateway.
- [ ] Document local dual-process run (`start:dev` + `start:game-worker`).

---

**Execution note:** Phases 0–1 + PvP unlock + Phase 3 render rewrite are done. Phase 2 intentionally deferred pending production scale.
