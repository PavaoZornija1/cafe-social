# Brawler Dedicated Game Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Nest-hosted 20 Hz Brawler combat tick into a dedicated `game-worker` process, after making inputs and session discovery Redis-backed so multi-pod (and worker) authority is correct.

**Architecture:** Clients still talk only to Nest (auth, matchmaking, input ingress, Socket.IO fan-out). Live combat/arena stay in Redis with CAS + tick locks. Worker (or Nest when `GAME_RUNTIME_TICK_OWNER=nest`) owns the tick loop, drains Redis inputs, writes combat, publishes snapshot/ended events over Redis pub/sub so any API pod can fan out and finalize. No client protocol rewrite; reuse `stepCombat` and existing combat document V1.

**Tech Stack:** NestJS 11, Redis (`GameRuntimeRedisService`), Socket.IO + Redis adapter, Jest, existing `brawler-combat-*` modules.

**Spec / prior art:**
- `docs/superpowers/specs/2026-07-17-authoritative-brawler-architecture-design.md` (Phase 2)
- `docs/superpowers/plans/2026-07-17-authoritative-brawler-runtime.md` (Task 7 deferred)

## Global Constraints

- Fail-closed on Redis when multi-pod / production requires it — no silent memory authority for multi-human.
- Local solo may use `GAME_RUNTIME_ALLOW_MEMORY=1` for arena/bot only; memory combat never for multi-human.
- Keep imports at tops; exhaustive switches; TDD for Redis input + tick-owner policy paths.
- Do not rewrite combat schema V1 or mobile input/snapshot protocol.
- Do not move Word, CMS, Clerk admin, Stripe, or billing into the worker.
- Sticky load-balancer sessions are optional for latency only, never for correctness.
- Do not commit unless the user asks.

## File map (target)

| Path | Responsibility |
|------|----------------|
| `backend/src/redis/game-runtime-policy.ts` | Extend with `resolveTickOwner(env)` → `'nest' \| 'worker'` |
| `backend/src/brawler/brawler-combat.types.ts` | Input mailbox + active-set key helpers / constants |
| `backend/src/brawler/brawler-combat-input-redis.service.ts` | Redis input enqueue / drain (latest-per-participant) |
| `backend/src/brawler/brawler-combat-session-registry.service.ts` | Redis `SET` of ACTIVE combat sessionIds |
| `backend/src/brawler/brawler-combat-bus.service.ts` | Redis pub/sub for snapshot + ended payloads |
| `backend/src/brawler/brawler-combat-sim.service.ts` | Tick loop uses Redis inputs + registry; gated by tick owner |
| `backend/src/brawler/brawler.service.ts` | Init still registers combat; enqueue goes to Redis |
| `backend/src/brawler/brawler.gateway.ts` | Subscribe to combat bus (not only in-process EventEmitter) |
| `backend/src/game-worker/main.ts` | Worker entry: minimal Nest context, tick owner only |
| `backend/src/game-worker/game-worker.module.ts` | Redis + combat sim + finalize listener deps |
| `backend/package.json` | `start:game-worker`, `start:game-worker:dev` |
| `backend/.env.example`, `docs/STAGING_STACK.md` | `GAME_RUNTIME_TICK_OWNER`, dual-process local run |

---

### Task 1: Tick-owner policy helper

**Files:**
- Modify: `backend/src/redis/game-runtime-policy.ts`
- Modify: `backend/src/redis/game-runtime-policy.spec.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `export type GameRuntimeTickOwner = 'nest' | 'worker'`
- Produces: `resolveTickOwner(env: GameRuntimeEnv & { GAME_RUNTIME_TICK_OWNER?: string }): GameRuntimeTickOwner`
- Default: `'nest'` when unset/invalid (keeps today’s single-process behavior)

- [ ] **Step 1: Write failing tests** for default `nest`, explicit `worker`, case-insensitive `NEST`/`WORKER`, and garbage → `nest`.

- [ ] **Step 2: Implement `resolveTickOwner`** and document in `.env.example`:
  ```bash
  # nest = API pods run combat tick (default). worker = only game-worker process ticks.
  # GAME_RUNTIME_TICK_OWNER=nest
  ```

- [ ] **Step 3: Run** `cd backend && npm test -- game-runtime-policy.spec.ts` — expect PASS.

---

### Task 2: Redis input mailbox

**Files:**
- Create: `backend/src/brawler/brawler-combat-input-redis.service.ts`
- Create: `backend/src/brawler/brawler-combat-input-redis.service.spec.ts`
- Modify: `backend/src/brawler/brawler-combat.types.ts` (key prefix constants)

**Interfaces:**
- Key: `v1:gm:brawler:inputs:{sessionId}` — Redis HASH field = `participantId`, value = JSON `BrawlerCombatInputV1`
- Produces:
  - `enqueueInput(sessionId, input): Promise<boolean>` — rate-limit (40/s/participant), reject older `seq`, overwrite latest
  - `drainInputs(sessionId): Promise<BrawlerCombatInputV1[]>` — HGETALL then DEL (or pipeline get+del) so only one tick owner consumes
- Memory mode (`GAME_RUNTIME_ALLOW_MEMORY=1`, Redis off): keep process-local Map behavior equivalent to today’s mailbox (single-process only)

- [ ] **Step 1: Failing tests** — enqueue overwrites by participant; lower `seq` ignored; drain empties; rate-limit returns false after 40/s.

- [ ] **Step 2: Implement service** using `GameRuntimeRedisService` (same fail-closed policy as combat Redis).

- [ ] **Step 3: Run** `cd backend && npm test -- brawler-combat-input-redis.service.spec.ts` — expect PASS.

---

### Task 3: Redis ACTIVE session registry

**Files:**
- Create: `backend/src/brawler/brawler-combat-session-registry.service.ts`
- Create: `backend/src/brawler/brawler-combat-session-registry.service.spec.ts`

**Interfaces:**
- Key: `v1:gm:brawler:combat:active` — Redis SET of `sessionId`
- Produces: `add(sessionId)`, `remove(sessionId)`, `list(): Promise<string[]>`
- Memory mode: in-process `Set` (single-process)

**Why:** Today `BrawlerCombatSimService.activeSessions` is process-local. A worker (or another API pod) cannot discover matches started elsewhere.

- [ ] **Step 1: Failing tests** for add/list/remove and memory fallback.

- [ ] **Step 2: Implement**; call `add` from combat init path and `remove` on ENDED / abort (wire in Task 5 if cleaner).

- [ ] **Step 3: Run** registry unit tests — expect PASS.

---

### Task 4: Wire Nest gateway path to Redis inputs (still Nest tick)

**Files:**
- Modify: `backend/src/brawler/brawler-combat-sim.service.ts`
- Modify: `backend/src/brawler/brawler-combat-sim.service.spec.ts`
- Modify: `backend/src/brawler/brawler.service.ts` (input path ~`enqueueInput`)
- Modify: `backend/src/brawler/brawler.module.ts`

**Behavior:**
- `BrawlerService` input handler → `BrawlerCombatInputRedisService.enqueueInput` (not in-process Map)
- `tickSession` → `drainInputs` from Redis
- `tickAll` iterates `sessionRegistry.list()` (merge with local set OK during transition)
- Keep Redis tick lock behavior unchanged
- Rate-limit moves into input Redis service (remove duplicate from sim if fully delegated)

- [ ] **Step 1: Update sim unit tests** to mock input Redis + registry.

- [ ] **Step 2: Implement wiring**; Nest still hosts tick (`TICK_OWNER=nest`).

- [ ] **Step 3: Run** `cd backend && npm test -- brawler-combat` — expect PASS.

- [ ] **Step 4: Manual smoke (Redis up):** two API processes optional; one human+bot match; confirm inputs apply when tick lock is on either process (or single process).

**Exit criteria for Tasks 1–4:** Multi-pod Nest tick is correct without a worker. Safe to ship this alone if worker is still deferred.

---

### Task 5: Redis pub/sub combat bus

**Files:**
- Create: `backend/src/brawler/brawler-combat-bus.service.ts`
- Create: `backend/src/brawler/brawler-combat-bus.service.spec.ts` (unit with mocked Redis publish/subscribe)
- Modify: `backend/src/brawler/brawler-combat-sim.service.ts`
- Modify: `backend/src/brawler/brawler.gateway.ts`
- Modify: `backend/src/brawler/brawler.service.ts` (`onCombatEnded`)

**Interfaces:**
- Channel: `v1:gm:brawler:combat:bus`
- Payloads: same shapes as today’s `BrawlerCombatSocketPayload` and `BrawlerCombatEndedPayload` (add `kind: 'snapshot' | 'ended'`)
- Sim **publishes** after successful `writeState` / on ENDED (in addition to or instead of process-local `EventEmitter` when Redis enabled)
- Gateway **subscribes** and emits Socket.IO `combat` to `match:{sessionId}`
- `BrawlerService.onCombatEnded` **subscribes** (or listens via bus) so finalize still runs on an API pod even when worker ticks

**Memory mode:** keep `EventEmitter2` only (no Redis bus).

- [ ] **Step 1: Tests** — publish snapshot → subscriber callback invoked with payload.

- [ ] **Step 2: Implement bus**; dual-path emit: local EventEmitter when memory, Redis when enabled.

- [ ] **Step 3: Run** related Jest specs — expect PASS.

---

### Task 6: Gate Nest tick loop on `GAME_RUNTIME_TICK_OWNER`

**Files:**
- Modify: `backend/src/brawler/brawler-combat-sim.service.ts`
- Modify: `backend/src/brawler/brawler-combat-sim.service.spec.ts`
- Modify: `backend/src/main.ts` (optional log at boot: tick owner mode)

**Behavior:**
- `onModuleInit`: start `setInterval` **only if** `resolveTickOwner(env) === 'nest'`
- When `worker`: Nest still accepts inputs, serves WS, finalizes via bus; does **not** call `tickAll`
- Log clearly at boot: `Brawler combat tick owner: nest|worker`

- [ ] **Step 1: Tests** — with env `worker`, `onModuleInit` does not schedule interval; with `nest`, it does.

- [ ] **Step 2: Implement gate**.

- [ ] **Step 3: Run** sim specs — expect PASS.

---

### Task 7: Game-worker entrypoint

**Files:**
- Create: `backend/src/game-worker/main.ts`
- Create: `backend/src/game-worker/game-worker.module.ts`
- Modify: `backend/package.json` scripts
- Modify: Nest build/`tsconfig` if needed so `dist/game-worker/main.js` is emitted (mirror `main.ts` pattern)

**Module includes:** Config, Redis/GameRuntime, Prisma (for finalize), EventEmitter or bus subscriber, `BrawlerCombatRedisService`, input Redis, session registry, combat bus, `BrawlerCombatSimService`, and the finalize listener currently on `BrawlerService.onCombatEnded` (extract to a small `BrawlerCombatFinalizeListener` if needed so worker and API can share it without pulling full HTTP `BrawlerModule`).

**Behavior:**
- Force/require `GAME_RUNTIME_TICK_OWNER=worker` semantics inside worker (always run tick loop)
- No HTTP server (or bind health on `GAME_WORKER_HEALTH_PORT` only — optional)
- Refuse boot if Redis required and missing
- `npm run start:game-worker` → `node dist/game-worker/main`
- `npm run start:game-worker:dev` → watch entry (nest start or ts-node/tsx — match repo style)

- [ ] **Step 1: Scaffold module + main**; boot logs “game-worker listening for combat ticks”.

- [ ] **Step 2: Extract finalize listener** if API+worker both need it without circular HTTP deps.

- [ ] **Step 3: Scripts + typecheck** — `cd backend && npm run typecheck` PASS.

---

### Task 8: Dual-process local + deploy docs

**Files:**
- Modify: `backend/.env.example`
- Modify: `docs/STAGING_STACK.md`
- Modify: `docs/superpowers/plans/2026-07-17-authoritative-brawler-runtime.md` (mark Task 7 done / link here)
- Modify: `README.md` or `GETTING_STARTED.md` only if those already document Redis game runtime

**Document:**
```bash
# Terminal A — API (no tick)
GAME_RUNTIME_TICK_OWNER=worker REDIS_URL=redis://127.0.0.1:6379 npm run start:dev

# Terminal B — worker
GAME_RUNTIME_TICK_OWNER=worker REDIS_URL=redis://127.0.0.1:6379 npm run start:game-worker:dev
```
- Staging/prod: second Deployment/service sharing Redis + Postgres; scale workers by concurrent matches
- Rollback: set `GAME_RUNTIME_TICK_OWNER=nest` and stop worker

- [ ] **Step 1: Write docs** as above.

- [ ] **Step 2: Local smoke** — dual process, human+bot, then two-human if feasible; kill worker mid-match; confirm lock TTL failover when a second worker or nest fallback starts.

---

### Task 9: Integration / failover tests

**Files:**
- Create: `backend/src/brawler/brawler-combat-worker.integration.spec.ts` (or under `backend/test/`) — skip if no Redis unless `REDIS_URL` set

**Cases:**
1. Enqueue on “API” service instance → drain+tick on “worker” instance → combat `tick` advances and HP/state changes
2. Kill tick owner (release lock / stop renewing) → second owner acquires → continues from same `rev`
3. ENDED publish → finalize listener claims Postgres once (mock Prisma OK)

- [ ] **Step 1: Write integration tests** gated on Redis.

- [ ] **Step 2: Run** with Redis — expect PASS.

---

## Suggested ship slices

1. **Slice A (ship anytime):** Tasks 1–4 — Redis inputs + registry; Nest still ticks. Fixes multi-pod input correctness.
2. **Slice B:** Tasks 5–6 — bus + tick gate; still one process in prod until worker exists.
3. **Slice C:** Tasks 7–9 — worker process + docs + failover proofs.

## Out of scope

- Client render changes, Word worker, GGPO/rollback, cross-region Redis, changing Socket.IO
- Admin/CMS on worker
- Rewriting combat document to V2

## Exit criteria (Phase 2 done)

- [ ] With `GAME_RUNTIME_TICK_OWNER=worker`, API pods do not run `setInterval` tick
- [ ] Worker advances combat under Redis lock; snapshots reach clients via any API pod
- [ ] Finalize still writes Postgres winner from combat document once
- [ ] Worker crash mid-match recovers via lock TTL + second worker (or temporary nest fallback)
- [ ] Local dual-process documented; `.env.example` complete
