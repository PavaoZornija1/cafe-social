# Cafe Social — product backlog & Supabase plan

Last updated: 2026-06-13. Living doc for pilot follow-ups and infrastructure.

---

## Product backlog (prioritized)

### Done recently (reference)

- 5-tab app shell (Home · Play · Venues · Friends · Me)
- CMS-driven tier ladder (`PlatformAutomatedReward`) + automated perk grants
- Platform quest hub + bundle claims + auto-refresh events
- Pilot venue seed (5 Sarajevo venues)
- Push + email notifications (phase 1): social/reward channels, staff emails, `emailNotifications` pref
- Friends: Parties + Redeem invite navigation, inbox badge, party invite accept/decline
- Discover hub linked from Venues tab (compass)
- Background geofence → server presence on enter/exit

### On hold (explicit)

- **Receipts** — upload, owner review, staff emails, player push on review. Code remains; no product or UI work until re-prioritized.

### Next — pilot validation (highest ROI)

Run an **on-device dry-run** at a pilot venue with two accounts. Capture blockers only.

| Flow | Verify |
|------|--------|
| Sign-in / onboarding | Clerk, push token registration |
| Geofence + venue detect | Home strip, Venue hub access |
| Word game + quests | Quest hub refresh, bundle claim, XP |
| Tier unlock → perk wallet | CMS thresholds, push, staff QR redeem |
| Friends + parties | Tab badge, accept, Party detail |
| Staff redemption | Staff mode, QR scan |
| Order nudge (optional) | ~30 min dwell, tap → menu URL |
| Ban appeal (optional) | Player submit, staff resolve + push |

**Output:** short pilot blocker list; fix only what fails.

### Path A — “Pilot soon” (minimal new features)

1. Dry-run → fix blockers
2. TestFlight / internal build to staff + small player group
3. Iterate on copy and UX from feedback

### Path B — “Polish before pilot”

1. Dry-run → fix blockers
2. Admin UI for `platform-automated-rewards` (tier names, thresholds, quest bundle links)
3. Brawler match push + tap navigation
4. Foreground perk-unlock toast when app is open
5. README / env checklist sync
6. Then pilot

### Medium priority (post–dry-run)

- **Admin CMS** for tier/quest rewards (API exists; no UI in `admin/` yet)
- **Brawler notifications** — join/start push + deep link to lobby/arena
- **Foreground celebrations** — tier/quest perk granted while app is open
- **Push hardening** — invalid Expo token cleanup, receipt polling optional
- **Staff urgent push** — appeals/receipts if staff use mobile app (email exists today)
- **Unified Inbox screen** — optional; Friends tab + badge may suffice for pilot
- **“Open now” venue filter** — blocked on venue hours API
- **Sign in with Apple** — disabled in `app.config.js`; needed for broad App Store launch
- **DiscoverHub** — linked; consider trimming duplicate “open map” tile later

### Store / release (when leaving closed pilot)

- EAS production builds
- App Store / Play assets
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` / terms in prod
- Physical-device push verification
- `PARTNER_PORTAL_BASE_URL` for staff email deep links (Resend)

### Defer / don’t do yet

- Receipts (on hold)
- Background dwell without foreground app (platform limits; geofence task is best-effort)
- Replacing NestJS with Supabase-only architecture
- Replacing Clerk with Supabase Auth (large migration)
- Replacing Socket.IO with Supabase Realtime (large migration)
- Per-friend live location / venue presence beyond current privacy model

### Open decisions (fill in when planning pilot)

| Question | Notes |
|----------|--------|
| Pilot audience | Internal + staff only vs public TestFlight at 5 venues |
| Hero game | Word vs brawler vs equal — drives notification polish |
| Who configures tiers | Dev/DB vs partner ops in admin CMS |
| Pilot date | Hard deadline vs open beta |

---

## Supabase setup plan

### Goal (phase 1)

Use **Supabase as managed PostgreSQL** for dev/staging/production. **Keep** NestJS API, Clerk auth, Socket.IO, Redis (optional), Expo app, and Next admin — minimal application code change.

Supabase is **not** a full platform migration in phase 1; it replaces self-hosted/local Postgres.

### What stays the same

| Component | Role |
|-----------|------|
| **NestJS `backend/`** | All business logic, Prisma, JWT validation, push, email, cron |
| **Clerk** | Auth for app + admin + API (`CLERK_SECRET_KEY`) |
| **Prisma** | ORM + migrations (58 migrations today) |
| **Expo `app/`** | Talks to Nest API only (`EXPO_PUBLIC_API_URL`) |
| **Next `admin/`** | Talks to Nest API + Clerk |
| **Redis** (optional) | Socket.IO adapter + game runtime — use Upstash or keep local; not Supabase |

### What Supabase provides (phase 1)

- Managed **PostgreSQL** (backups, dashboard, SQL editor)
- Connection **pooling** (Supavisor) for serverless/scaled API workers
- Optional: **Storage** later for receipt/perk images (receipts on hold)
- Optional: **Branches** for preview DBs (Pro plan)

### What we are NOT doing in phase 1

- Supabase Auth (would replace Clerk across app/admin/backend)
- Supabase Realtime (would replace Socket.IO `/word-match` + brawler)
- Edge Functions replacing Nest controllers
- PostgREST / direct mobile → Supabase client (would require RLS rewrite)

### Architecture (target)

```
[Expo app] ──HTTPS──► [NestJS API] ──Prisma──► [Supabase Postgres]
[Next admin] ──HTTPS──► [NestJS API]              (pooled URL at runtime)
                         │
                         ├── Clerk JWT verify
                         ├── Redis (optional)
                         └── Socket.IO
```

Mobile and admin **never** connect to Supabase directly; no RLS required for phase 1 if all access is server-side.

### Implementation phases

#### Phase 0 — Decisions (before touching prod data)

1. **Environments:** e.g. `cafe-social-dev`, `cafe-social-staging`, `cafe-social-prod` (separate Supabase projects recommended).
2. **Local dev:** keep local Postgres **or** point dev machines at Supabase dev project (team preference).
3. **API hosting:** where Nest runs in prod (Railway, Oracle VM) — Supabase does not host Nest.
4. **Region:** choose EU (e.g. Frankfurt) if pilot is Sarajevo/EU-heavy.

#### Phase 1 — Supabase project + schema

1. Create Supabase project in dashboard.
2. Copy **database password** and connection strings:
   - **Direct** (session mode, port 5432) — migrations, seed, Prisma introspect
   - **Pooler** (transaction mode, port 6543) — NestJS runtime (`?pgbouncer=true`)
3. Update Prisma datasource (when implementing):

   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")        // pooled, for app
     directUrl = env("DIRECT_DATABASE_URL") // direct, for migrate
   }
   ```

4. Set env:

   ```bash
   # Runtime (pooler)
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

   # Migrations / seed (direct)
   DIRECT_DATABASE_URL="postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres"
   ```

5. Run against empty Supabase DB:

   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma db seed
   ```

6. Smoke-test: `GET /api/health`, sign-in, `GET /players/me/summary`.

#### Phase 2 — CI/CD & secrets

1. Store `DATABASE_URL` + `DIRECT_DATABASE_URL` in CI (GitHub Actions) and hosting provider.
2. Migration job: `prisma migrate deploy` on deploy (uses direct URL).
3. Document in `backend/.env.example` (Supabase variants commented).
4. Never commit Supabase service role key to mobile app (not needed for phase 1).

#### Phase 3 — Optional Supabase features (later)

| Feature | When | Notes |
|---------|------|--------|
| **Storage** | Receipts or venue assets | Move base64 out of Postgres; Nest uploads via service role |
| **Database branches** | PR previews | Supabase Pro; branch per PR |
| **Log drain / metrics** | Production ops | Supabase dashboard + API host logs |
| **Upstash Redis** | Multi-instance API | If scaling Socket.IO beyond one Node |

### Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Migrate on wrong connection (pooler) | Use `directUrl` for `prisma migrate`; document clearly |
| Connection limit on free tier | Use pooler for API; limit Nest instances or upgrade |
| Latency dev → cloud DB | Keep local Postgres for offline dev optional |
| Large seed/migration timeout | Run seed from CI or local with direct URL |
| IPv6 / SSL issues | Use Supabase-provided URI; Prisma 7 + `pg` handles SSL |

### Rollback

- Keep local Postgres backup until Supabase prod is verified.
- `DATABASE_URL` swap reverts API to old DB (no code deploy needed).

### Checklist (implementation session)

- [ ] Create Supabase project(s) + note region
- [ ] Add `DATABASE_URL` + `DIRECT_DATABASE_URL` to `backend/.env`
- [ ] Add `directUrl` to `schema.prisma`
- [ ] Update `backend/.env.example` with Supabase comments
- [ ] `prisma migrate deploy` + seed on Supabase
- [ ] Verify app + admin against cloud DB
- [ ] Choose API host for staging/prod
- [ ] Wire staging env vars
- [ ] Update `GETTING_STARTED.md` with Supabase option (one paragraph)

### Out of scope for Supabase work

- Product backlog items above (unless blocked by DB hosting)
- Clerk migration
- Realtime migration
- Receipt feature

---

## Suggested order of work

1. **Supabase phase 1** — hosted Postgres for staging (unblocks team + deploy)
2. **Pilot dry-run** — on staging or prod-like env
3. **Blocker fixes** from dry-run
4. **Admin tier CMS** or **TestFlight** — depending on Path A vs B
