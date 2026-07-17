# Authoritative Brawler + Multi-Pod Game Runtime Design

**Date:** 2026-07-17  
**Status:** Draft for review  
**Goal:** Make Brawler real-time PvP and ranked safe on multi-pod deployments using industry best practice: clients send inputs, a simulation owner ticks, Redis holds live state, Postgres holds durable results.

---

## 1. Problem

Today:

- Combat is **client-authoritative** (each device simulates locally; winner/kills reported by the client).
- 2-human and ranked play are correctly **blocked** because that model is exploitable.
- Arena/power-up state uses Redis with a **per-process memory fallback**, which is unsafe on multi-pod.
- Socket.IO uses a Redis adapter only when `REDIS_URL` is set; otherwise fan-out is process-local.
- Word match is already closer to best practice (Postgres source of truth + optional Redis mirror).

We need a path that:

1. Makes multi-pod game runtime **fail-closed** on Redis.
2. Introduces **authoritative combat**.
3. Unlocks honest 2-human + ranked play.
4. Improves client render performance.
5. Ends in a **dedicated game worker** without rewriting Redis schemas twice.

---

## 2. Target architecture (long-term best practice)

```text
Mobile clients
  │  inputs only (move / aim / fire / pickup intent)
  │  render snapshots + prediction
  ▼
Nest API + Socket.IO gateway pods
  │  auth, matchmaking, subscribe, forward inputs, emit snapshots
  ▼
Game simulation worker(s)
  │  owns match tick lock; runs physics/combat at fixed Hz
  ▼
Redis (required)
  │  live combat + arena documents with CAS / locks
  ▼
Postgres
     durable GameSession, participants, finalize claim, XP/Elo, GameEvent audit
```

### Layer rules

| Layer | Owns | Must not own |
|-------|------|--------------|
| Client | Prediction, interpolation, HUD, input capture | HP, KO, winner, hit detection |
| Nest gateway | Auth, REST/WS, matchmaking, fan-out | Continuous physics loop (long-term) |
| Game worker | Tick, combat resolution, match clock | Billing, CMS, partner portal |
| Redis | Live match documents | Durable billing / account truth |
| Postgres | Session lifecycle, results, economy | High-frequency positions |

Sticky load-balancer sessions are **optional for latency only**, never for correctness.

---

## 3. Phased delivery

### Phase 0 — Multi-pod Redis foundation (no PvP unlock yet)

**Must ship first.**

1. Treat `REDIS_URL` as required for any deployment that runs game sockets/matchmaking across >1 pod.
   - Local single-process dev may keep Redis optional with an explicit `GAME_RUNTIME_ALLOW_MEMORY=1` escape hatch for bot/solo only.
   - Production / staging multi-pod: missing Redis = **startup failure** for game runtime (or refuse to enable Socket.IO + arena/combat routes).
2. Remove fail-open memory fallback from `BrawlerArenaRedisService` for Redis-enabled mode.
   - On Redis write/CAS failure: return 503/409 to caller; do not mutate a local `Map` as authority.
3. Socket.IO Redis adapter remains mandatory whenever Redis is required.
4. Document ops: both `GameRuntimeRedisService` and `RedisIoAdapter` need the same Redis.
5. Word bot driver may keep its in-memory pacing Map **only** while Postgres advisory lock + rehydrate remain; follow-up may move bot pacing cursors into Redis.

**Exit criteria:** Two Nest pods + Redis; arena picks/spawns consistent; no silent memory split-brain.

---

### Phase 1 — Authoritative combat bridge (Nest-hosted tick)

Introduce Redis combat state and a Nest-side simulation owner so we can unlock PvP without waiting for a separate process.

#### 1.1 Redis documents

| Key | Purpose |
|-----|---------|
| `v1:gm:brawler:arena:{sessionId}` | Existing power-up / buff arena state (CAS on `rev`) |
| `v1:gm:brawler:combat:{sessionId}` | **New** combat state (CAS on `rev`) |
| `v1:gm:brawler:combat:lock:{sessionId}` | Tick owner lock (TTL ~2–3× tick period) |
| `v1:gm:brawler:inputs:{sessionId}` | Optional short input queue / mailbox |

Combat document (conceptual):

```ts
type BrawlerCombatLiveStateV1 = {
  v: 1;
  sessionId: string;
  rev: number;
  status: 'ACTIVE' | 'ENDED';
  startedAtMs: number;
  endsAtMs: number;
  tick: number;
  world: { w: number; h: number }; // logical world; use normalized coords
  fighters: Array<{
    participantId: string;
    playerId: string | null;
    isBot: boolean;
    x: number; // normalized 0..1 or fixed logical units — pick one and stick
    y: number;
    vx: number;
    vy: number;
    facing: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    kills: number;
    deaths: number;
    cooldowns: Record<string, number>;
    buffs: Array<{ powerupId: string; untilTick: number; magnitude: number }>;
  }>;
  projectiles?: Array<{
    id: string;
    ownerParticipantId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
  }>;
  winnerParticipantId?: string | null;
  endReason?: 'KO' | 'TIME' | 'FORFEIT' | 'ABORT';
};
```

Use **normalized or fixed logical coordinates** (same convention as arena `nx`/`ny`) so device resolution never affects authority.

#### 1.2 Tick ownership

- Fixed rate: **20 Hz** simulation (50ms). Snapshot broadcast: **10–20 Hz**.
- Exactly one owner per match via Redis lock (`SET key token NX PX ttl` + renew).
- Any Nest pod may attempt to acquire; only the lock holder advances `tick` and writes combat CAS.
- If lock expires (pod death), another pod acquires and continues from last Redis combat rev.

#### 1.3 Client protocol

Clients send **inputs**, not outcomes:

- `input` WS/REST: `{ sessionId, participantId, seq, tickAck, moveX, moveY, aimX, aimY, fire, pickup }`
- Server validates membership + rate-limits.
- Simulation applies inputs on the next ticks.
- Server emits `combatSnapshot` (full or delta) to Socket.IO room `match:{sessionId}`.

Clients may **predict** locally for responsiveness, then **reconcile** to snapshots. Prediction is cosmetic; authority is Redis/combat.

#### 1.4 Bot AI

- Bot decisions run **inside the tick owner**, writing into the same combat document.
- Remove reliance on each human client simulating enemies locally for ranked/2-human.
- Casual 1-human+bot uses the same authoritative path (recommended) so one codepath.

#### 1.5 Finalize

- When combat `status=ENDED`, tick owner (or finalize endpoint) claims Postgres `ACTIVE → FINISHED` once.
- Winner / kills / deaths taken from combat document, **not** client payload.
- Client finalize becomes “acknowledge end / fetch post-game”, or submits nothing decisive.
- Remove multi-human finalize rejection once combat SoT is live and tested.

#### 1.6 Unlock criteria for PvP / ranked

Only after:

- Phase 0 complete
- Combat Redis + tick lock + input path live
- Integration tests: two clients, pod kill mid-match, duplicate finalize, input injection by non-member rejected
- Hold overlay + ranked UI gates removed deliberately

**Exit criteria:** Two humans can finish a match with server-agreed winner; ranked Elo uses that result.

---

### Phase 2 — Dedicated game worker (long-term, **deferred**)

> **Deferred 2026-07-18.** Combat tick currently runs inside Nest (Phase 1 bridge). Extract later — not required for PvP correctness now that Redis combat + locks + server finalize exist.

**What:** A separate backend process (same repo), not another user-facing app. Nest stays the only thing clients hit.

Extract Phase 1 tick loop into that process so it:

- Imports the same combat/arena Redis schemas and CAS helpers
- Does not serve partner CMS / Clerk admin traffic
- Scales on active matches, not HTTP QPS
- Nest becomes pure gateway (auth, matchmaking, WS fan-out, REST)

**Why separate (ops benefits):**
- API load ≠ sim load — don’t let CMS/admin traffic steal tick CPU
- Worker death → another owner takes Redis lock; API can stay up
- Horizontal scale of workers by concurrent matches

Deployment sketch:

- `backend` API Deployment
- `game-worker` Deployment (same monorepo package or `backend/src/game-worker` entrypoint)
- Shared Redis + Postgres

**No schema rewrite** between Phase 1 and 2 if combat keys/protocol are stable.

---

### Phase 3 — Client render rewrite (parallelizable)

Independent of worker extraction:

- Stop full React tree re-render every animation frame in `useArenaGameLoop`
- Drive world/sprites via refs / Reanimated / Skia / canvas
- React updates HUD only on discrete changes (hp, timer, score, match end)
- Keep input sampling high-frequency; snapshot reconcile smooth

Can start after Phase 1 inputs/snapshots exist (or slightly overlapping).

---

## 4. Word game stance

Word remains:

- **Postgres** authoritative for room/deck/scores
- **Redis** live snapshot mirror + Socket.IO fan-out
- No continuous physics worker needed

Follow-ups (smaller):

- Soften Redis-optional behavior in multi-pod (same Redis requirement policy)
- Optionally move bot pacing cursors to Redis later

---

## 5. Security & anti-cheat

- All combat mutations require authenticated participant membership (already required for arena routes; keep for inputs).
- Reject client-supplied winner/kills/deaths once combat SoT exists.
- Rate-limit inputs per participant.
- Cap numeric ranges (move vector magnitude, fire rate).
- Log authoritative `GameEvent` samples for audit (hits, KO, end), not client claims.

---

## 6. Local / CI / production config

| Env | Redis | Memory arena fallback | Combat |
|-----|-------|-----------------------|--------|
| Local solo without Redis | Optional with `GAME_RUNTIME_ALLOW_MEMORY=1` | Allowed for solo/bot only | Prefer Redis; memory combat **disallowed** for multi-human |
| Staging / production | Required | Forbidden | Redis combat required |

Startup check (production):

- If `NODE_ENV=production` or `GAME_RUNTIME_REQUIRE_REDIS=1`: refuse boot without Redis connection for game modules.

---

## 7. Testing strategy

- Unit: combat tick transitions, CAS conflict retries, lock acquire/expire, input validation
- Integration: two fake clients + Redis; kill tick owner mid-match; resume
- Regression: casual bot match still awards XP once; ranked only after unlock
- Load smoke: N matches × 20 Hz tick with Redis

---

## 8. Non-goals (this program)

- Rewriting Word into a combat-style worker
- Full rollback netcode / GGPO
- Cross-region multi-master Redis
- Replacing Socket.IO

---

## 9. Implementation order (when approved)

1. Spec approval
2. Implementation plan (`docs/superpowers/plans/…`)
3. Phase 0 PR (Redis fail-closed + require Redis)
4. Phase 1 PRs (combat doc, tick lock, inputs, snapshots, finalize from server, unlock PvP)
5. Phase 3 render PR (can overlap late Phase 1)
6. Phase 2 worker extraction PR

---

## 10. Open decisions locked by this design

- Long-term sim host: **dedicated game worker**
- Near-term bridge: **Nest tick + Redis combat** (same schemas)
- Live store: **Redis only** (fail-closed); Postgres durable
- Coord space: **normalized / logical**, not device pixels
- Unlock ranked/2-human only after Phase 1 exit criteria
