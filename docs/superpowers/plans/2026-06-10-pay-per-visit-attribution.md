# Pay-Per-Visit Attribution & Foot-Traffic Ledger

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record proximity nudges, area foot traffic (100 m ring), and in-venue polygon sessions so attributed visits (nudge → polygon enter ≤15 min → dwell ≥15 min) can power future pay-per-visit billing and partner analytics.

**Architecture:** Reuse `ProximityArrivalPushLog` (multi-nudge/day), `PlayerVenueGeofenceEvent` (ring enter/exit with `boundaryType`), and `VenueFunnelEvent` (append-only analytics). Add `PlayerVenuePolygonSession` for polygon dwell + attribution. Polygon presence comes only from `POST /social/me/presence` (client polygon detect), not from OS ring enter.

**Tech Stack:** NestJS, Prisma/PostgreSQL, existing push + geofence pipeline.

**Stripe / invoicing:** Not in this phase — ledger only (`billableAt` timestamp when rules pass).

---

## Billable visit rule (v1)

1. Proximity arrival nudge sent (`ProximityArrivalPushLog`).
2. Player enters partner **play polygon** within **15 minutes** after `sentAt`.
3. **≥15 minutes** continuous polygon dwell in that session (measured on polygon exit).
4. Multiple billable sessions per player/venue/day allowed (e.g. morning + evening), each linked to its own nudge when applicable.

## Nudge policy (v1)

- Per venue per day: up to **3** nudges (configurable).
- **4 h cooldown** between nudges to the same venue unless player has no open polygon session there.
- Global cap: **5** nudges/player/day (configurable).
- Skip nudge if player already has polygon presence at that venue (`lastPresenceVenueId`).

## Analytics layers

| Layer | Source | Use |
|-------|--------|-----|
| Area traffic | `PlayerVenueGeofenceEvent` (`proximity_ring`) | Foot traffic near venue |
| In-venue sessions | `PlayerVenuePolygonSession` | Dwell, attribution, future PPV |
| Event stream | `VenueFunnelEvent` | CSV export, funnels |
| Nudges | `ProximityArrivalPushLog` | Campaign performance |

---

## Deferred: advance check-in on partner map (NOT implementing now)

**Idea:** Players can **check in to a venue in advance** (planned visit — e.g. “I’ll be at Café X tonight at 7pm”). Partner portal **map / dashboard** would show aggregate or anonymized signals such as:

- Count of **planned arrivals** in the next N hours
- Optional heat by time window (not live player tracking on a public map without privacy review)

**Open questions for later discussion:**

- Privacy: opt-in only? Friends-only vs staff-only vs aggregate counts only?
- Data model: extend `PlayerVenueCheckIn` vs new `PlayerVenuePlannedVisit` with `plannedArrivalAt`, `status` (planned | arrived | cancelled)
- Map UX: pin on partner geofence vs list widget; no exact home addresses
- Billing: planned check-ins are **not** billable until polygon attribution rules pass
- Relation to existing explicit QR check-in (`requiresExplicitCheckIn`)

**Tracking:** See `docs/superpowers/plans/FUTURE-partner-advance-check-in.md` (stub).

---

## Implementation status

- [x] Schema migration + services (this PR)
- [x] Partner portal: attributed visits dashboard
- [x] Stripe metered billing on `billableAt` (usage records)
- [ ] Advance check-in (deferred)
