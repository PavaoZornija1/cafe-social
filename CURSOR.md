# Cafe Social — Cursor / AI context

Location-aware social gaming for cafés and partner venues: geofenced venue context, challenges, word games, perks, social graph, and a partner portal.

## Monorepo map

| Package | Path | Stack |
|--------|------|--------|
| **API** | `backend/` | NestJS 11, Prisma 7, PostgreSQL, Clerk JWT, Socket.IO (`/word-match`), optional Redis adapter |
| **Mobile** | `app/` | Expo SDK 54, React 19, React Navigation, Clerk, i18n (en/de/es/hr) |
| **Partner portal** | `admin/` | Next.js 15, Clerk, TanStack Query/Table/Form |

Canonical human docs: **`README.md`** (setup, env vars, API narrative). Partner-facing PDF-style notes: **`docs/prilog-za-partnera-cafe-social.md`**.

## Auth & roles

- **Clerk** issues JWTs; backend resolves `Player` by email (see `normalizeUserEmail` / auth guards).
- **`Player.platformRole`**: `SUPER_ADMIN` unlocks `/api/admin/*` CMS (venues, words, challenges, perks, staff assignment, etc.).
- **Venue staff** (`VenueStaff`): `EMPLOYEE` | `MANAGER` | `OWNER` — owner APIs under `/api/owner/*` with `VenueStaffGuard` + `MinVenueRole`. Partner write paths may use `PartnerVenueWriteGuard` (billing/trial lock).

## API layout (mental model)

- **`/api/venue-context/*`** — detect venue, access, register, challenges in context, perk redeem, receipts, report player (`POST …/report-player`), offers.
- **`/api/venues/*`** — public card, XP leaderboards (venue / city / country / global).
- **`/api/players/*`** — CRUD (mostly internal), **`me/*`** summary, settings, engagement, push tokens, perk redemption history, **ban appeals** (`POST me/ban-appeals`).
- **`/api/social/*`** — presence, people-here, friends, discover, venue feed, friends-visit aggregate.
- **`/api/words/*`** — sessions, daily word, match Socket namespace (see README).
- **`/api/owner/*`** — partner: analytics (incl. funnel + loyalty metrics), redemptions, campaigns, receipts, staff invites, **moderation** (reports, bans, staff-summary, ban-appeals).
- **`/api/admin/*`** — super-admin CMS.
- **`/api/webhooks/*`** — Stripe, RevenueCat.

Global prefix: **`/api`** (see `main.ts`).

## Data & migrations

- Schema: **`backend/prisma/schema.prisma`**.
- After schema changes: `npx prisma migrate dev` (local) / `migrate deploy` (prod), then `prisma generate`.
- Notable domains: `Venue` + GeoJSON geofence, `Challenge` + weekly `periodKey`, `VenuePerk` / redemptions, `VenuePlayerBan` / `VenuePlayerReport`, `VenueBanAppeal`, `PerkExpiryReminderLog`, `PlayerVenueVisitDay`, org/billing fields on venues and organizations.

## Nest modules — circular dependency

**`PlayerModule` ↔ `VenueModule`** import each other (`PlayerController` needs `VenueModerationService`; venue layer needs `PlayerService`). Both use **`forwardRef(() => OtherModule)`** in `imports`. Do not remove `forwardRef` without extracting a third module (e.g. `VenueModerationModule`).

## Scheduled / background jobs

- **`@nestjs/schedule`**: registered once in **`app.module.ts`** (`ScheduleModule.forRoot()`).
- **Perk expiry reminders**: `PerkExpiryReminderScheduler` in `perk/` (cron ~4h; env `PERK_EXPIRY_REMINDERS_ENABLED=0` to disable). Respects `totalPrivacy` / `partnerMarketingPush`.

## Mobile app entrypoints

- Navigation: **`app/src/navigation/`** (`RootStack.tsx`, `type.ts`).
- API base: **`EXPO_PUBLIC_API_URL`** (must include `/api`; use LAN IP on device).
- Staff flows: **`ownerStaffApi.ts`**, staff screens; moderation snapshot uses **`GET /owner/venues/:id/moderation/staff-summary`** (JWT + venue staff).

## Admin app entrypoints

- Portal routes under **`admin/src/app/`**; API helpers **`admin/src/lib/queries/`**, **`portalApi`**.
- Venue detail: analytics (incl. **loyalty** / repeat visits), moderation, appeals, redemptions, campaigns, receipts.

## Testing

```bash
cd backend && npm test
```

Example: **`venue-moderation.service.spec.ts`** (report caps, appeals).

## Conventions for agents

- Prefer **small, focused diffs**; match existing patterns in the package you touch.
- **Do not** break the `PlayerModule` / `VenueModule` `forwardRef` pairing.
- New owner routes: align guards with existing moderation endpoints (`VenueStaffGuard`, `MinVenueRole`, `PartnerVenueWriteGuard` where mutations).
- Expo pushes: respect **`partner_marketing`** vs **`match`** channels and privacy flags (see `PushService`).

## What is implemented today (high level)

- Geofence detect + venue access (premium / QR / subscription), challenges with weekly resets, word match + daily word, brawler, social (friends, parties, presence, people-here, feed), invites, XP & leaderboards, perks & offers & receipt upload, owner analytics (funnel, per-perk, hours, **loyalty / repeat visits**), campaigns, Stripe/RevenueCat hooks.
- **Trust & safety**: venue-scoped reports (`venue-context/.../report-player`) with rate limits; venue bans enforced on access, play limits, perks, challenge progress; **ban appeals** (player + owner list/dismiss); **staff moderation summary** for on-site apps; leaderboard **report** for venue scope.
- **Perk expiry reminder** pushes (scheduled, idempotent log).

## Good next steps (product / engineering)

1. **Store readiness** — EAS production builds, store listings, legal URLs in env (`EXPO_PUBLIC_*`).
2. **Background / dwell** — README already notes limits; optional native geofence tasks for better dwell measurement.
3. **Appeals workflow** — richer statuses, staff notes, optional email/push to player on resolution.
4. **Friends-at-venue** — today aggregate-only; any per-user reporting needs explicit privacy design + API.
5. **Observability** — structured logging / metrics for push failures, cron passes, moderation volume.
6. **README sync** — extend `README.md` “What’s implemented” with moderation, appeals, loyalty analytics, perk reminders if you want a single public doc to match code.
