# Cafe Social

**Location-aware social gaming for cafés and other physical venues.** Players unlock challenges and games when they’re at a partner venue (geofenced). This repo is the Cafe Social monorepo: **NestJS + Prisma** backend and **Expo (React Native)** mobile app.

## Repo layout

| Path | Description |
|------|-------------|
| `backend/` | NestJS API (`/api`), PostgreSQL via Prisma, Clerk JWT auth |
| `app/` | Expo SDK 54 app (iOS/Android), Clerk, React Navigation |
| `admin/` | **Next.js 15** partner portal (**Clerk** only): **super admins** (`Player.platformRole`) get full CMS (venues, words, challenges, perks); **OWNER / MANAGER / EMPLOYEE** get venue dashboards, campaigns, receipts, JWT **staff redemptions** (`/staff/[venueId]`) |

## What’s implemented

### Backend (`backend/`)

- **Auth**: Protected routes validate **Clerk JWTs**. Users are resolved to a `Player` via email (or `sub@clerk.local` when email is absent).
- **Venues**: CRUD + **geofence detection** — `GET /venue-context/detect` with optional `?lat=&lng=` selects a venue whose `latitude` / `longitude` / `radiusMeters` contains the point (Haversine). Without coordinates, falls back to a **default venue** (dev / simulator friendly).
- **Access**: `GET /venue-context/:venueId/access` — premium vs QR unlock vs subscription rules for entering a venue’s **context**.
- **QR / unlock**: `POST /venue-context/:venueId/register` — links `PlayerVenue` after “scan” (app currently uses manual venue id).
- **Challenges**: List + `POST …/progress` with **server rules** (`locationRequired`, `rewardVenueSpecific`, premium + QR exceptions). **`resetsWeekly`** on `Challenge`: progress/completion shown and incremented **per ISO week (UTC)** via `ChallengeProgress.periodKey`.
- **Words**: `GET /words/session` — random word deck with sentence / word / emoji hints (languages: `en`, `hr`, `de`, `es` in seed). **`POST /words/matches`**, **`POST /words/matches/join`**, **`POST …/start`**, **`GET …/state`** (includes optional **`venueId`**), **`GET …/deck`**, **`POST …/coop-guess`**, **`POST …/versus-score`** — co-op (shared word index) and versus (race) word matches with 6-char **invite codes** on `GameSession`.
- **Daily word (async, JWT)**: **`GET /words/daily?scope=global|venue&venueId=&detectedVenueId=&language=`** — one puzzle per **UTC calendar day** per scope (**`global`** or **`venue`**); deterministic word pick from the deck; returns length, attempts, streak, solved state. **`POST /words/daily/guess`** `{ scope, venueId?, detectedVenueId?, language?, guess }` — up to **6** guesses; **streak** stored per player per scope (`PlayerDailyStreak`). Venue scope requires **presence** (+ **QR** for premium venues). Solving a **venue** daily appends **`VenueFeedEvent`**.
- **Venue activity feed**: **`GET /social/venues/:venueId/feed?limit=`** — recent rows (`WORD_MATCH_STARTED` when a hosted word match **starts** at that venue, `DAILY_WORD_SOLVED` when someone solves the **venue** daily).
- **Player summary**: `GET /players/me/summary` — **global XP** = **sum of per-venue XP** (`PlayerVenueStats`); tier from that sum; **`playerId`** for client UI; challenge/venue counts; privacy flags `discoverable`, `totalPrivacy`; push prefs **`partnerMarketingPush`**, **`matchActivityPush`** (defaults on).
- **Player settings**: `PATCH /players/me/settings` — `{ discoverable?, totalPrivacy?, partnerMarketingPush?, matchActivityPush? }` (JWT).
- **Engagement / streaks**: `GET /players/me/engagement` — visit-day counts from **`PlayerVenueVisitDay`** (this UTC week, distinct venues last 30 days) and lightweight **badges** (e.g. 3+ visit days this week, 2+ venues in 30 days).
- **Perk redemptions**: `GET /players/me/perk-redemptions` — history with perk title/code.
- **Venue public card (no auth)**: `GET /venues/:id/public-card` — `menuUrl`, `orderingUrl`, optional **featured offer** (respects `featuredOfferEndsAt`).
- **Perks (JWT)**: `POST /venue-context/:venueId/perks/redeem` `{ code, detectedVenueId? }` — presence + optional QR-unlock perks (admin-configured).
- **Friends at venue (aggregate)**: `GET /social/venues/:venueId/friends-visit-summary` — count of accepted friends with any visit day at this venue in the last **30 UTC days** (no per-friend leakage).
- **Admin API (Clerk JWT, super admin only)**: **`Authorization: Bearer`** with a **Clerk session token** — only if **`Player.platformRole === SUPER_ADMIN`** — `/api/admin/...` for venues, words, challenge schedules, **VenuePerk** CRUD (see `admin/` app). Grant super admin in the **database**: set **`Player.platformRole`** to **`SUPER_ADMIN`** for the right row (e.g. Prisma Studio or SQL after the user has signed in once so a `Player` exists). **`GET/POST /admin/venues/:venueId/staff`**, **`DELETE /admin/venues/:venueId/staff/:playerId`** assign **Clerk** identities with roles **`EMPLOYEE` | `MANAGER` | `OWNER`** (creates `Player` by email if needed). Last **OWNER** cannot be removed or demoted without adding another OWNER first.
- **Owner API (Clerk JWT)**: **`GET /owner/me`** — platform role + venue staff rows; **`GET /owner/venues`** — same list (includes **`platformRole`**); super admins get **all** venues with effective **OWNER** access for analytics APIs. **`GET /owner/venues/:venueId/analytics?days=`** ( **`MANAGER`** or **`OWNER`** , or super admin ) — redemptions, visit-day rows, feed events; **`GET /owner/venues/:venueId/redemptions?date=YYYY-MM-DD`** ( **`EMPLOYEE`**+ ) — today’s perk redemptions with **staff verification codes** (used by the admin **`/staff/[venueId]`** page — **signed-in** staff only).
- **Challenges schedule**: optional **`activeFrom` / `activeTo`** (UTC) on **`Challenge`** — listed progress respects the window (“happy hour” style).
- **Push (Expo)**: `POST /players/me/push-token` `{ expoPushToken }`, `DELETE /players/me/push-token?expoPushToken=…` — stores **Expo push tokens** per device; **word match** sends notifications when someone **joins** the room or the host **starts** the match (**channel** `match`, payload `pushCategory: match`). **Venue order nudge** uses **channel** `partner_marketing` and includes `orderingUrl` / `menuUrl` in `data` (`pushCategory: partner_marketing`); recipients must have **`partnerMarketingPush`** and not **`totalPrivacy`**. Server-side category filtering is the baseline; OS notification settings still apply on device.
- **Per-venue XP**: earned on **challenge progress** at that venue (+10 per increment, +50 on first completion).
- **Venues**: `city`, `country`, `region` on venue model + CRUD DTOs; seed sets example geo for default venues.
- **Venue XP leaderboards** (aggregated from `PlayerVenueStats`): `GET /venues/:venueId/leaderboard/xp` (single venue); **`GET /venues/leaderboard/xp/global`**; **`GET /venues/leaderboard/xp/country/:country`** (e.g. `BA`); **`GET /venues/leaderboard/xp/city?city=…&country=…`** (case-insensitive city).
- **Social / presence**: `POST /social/me/presence` — `{ venueId }` or clear with `venueId: null`; records **`PlayerVenueVisitDay`** (one row per UTC day per venue) for engagement stats. **`venue dwell / order nudge`**: **not match‑specific** — the clock starts on the **first** presence update when the user is **detected at a venue** (geofence), regardless of what they’re doing in the app. The server stores `venueNudgeSessionStartedAt` for that **visit** and, after **`VENUE_ORDER_NUDGE_AFTER_MINUTES`** (default **30**) of **wall‑clock** time **on premise** (same `venueId` kept fresh by periodic presence pings), sends **one** Expo push per visit (“order a drink” style; skipped for **`totalPrivacy`** or **`partnerMarketingPush: false`**). Leaving the venue (`venueId: null`) or switching venue ends the visit. Copy: env defaults (`VENUE_ORDER_NUDGE_TITLE` / `VENUE_ORDER_NUDGE_BODY`, optional `{{venueName}}`) or per-venue **`orderNudgeTitle` / `orderNudgeBody`**; **`menuUrl` / `orderingUrl`** feed the push payload and app deep links. Set **`VENUE_ORDER_NUDGE_ENABLED=false`** to disable. `GET /social/venues/:venueId/people-here` — discoverability rules (friends stub if not public discoverable; strangers only if `discoverable`; `totalPrivacy` excludes); **`GET /social/venues/:venueId/feed`** — see **Venue activity feed** above; `GET /social/discover/subscribers` — **subscription-only**: lists other subscribers who are discoverable (remote layer).
- **Friends**: `GET /social/friends`, `GET /social/friends/incoming`, **`GET /social/friends/outgoing`**, **`DELETE /social/friends/outgoing/:friendshipId`** (cancel your pending request), `POST /social/friends/request`, **`POST /social/friends/request-by-username`** `{ username }` (case-insensitive), `POST /social/friends/accept`.
- **Invites**: `POST /invites/friend-link` — create friend invite token (rate limits); `POST /invites/redeem` `{ token }` — party or friend link (party: join + accepted friendship with **party creator**; friend-only: accepted friendship with link creator). Link TTL **24h**; daily link budget **4** (free) / **10** (subscriber UTC day); `maxUses` = party max size (**4** / **200**). **Use count increments** only for a **new** party join or **new** friendship via that link.
- **Parties** (JWT): `POST /parties`, `GET /parties/mine`, `GET /parties/:partyId`, `POST .../leave`, `POST .../transfer-leadership`, `POST .../kick`, `POST .../invite-friend` (must already be friends), `POST .../invite-link` (**leader only**), `POST .../revoke-invite-link`, `POST .../mesh-friend-requests`. **creatorId** fixed; **leaderId** has kick/link powers; transferring leadership removes creator’s powers unless they are leader again; **random new leader** if leader leaves; **empty party deleted**. Free tier: **2 created parties**, **4** max members each; subscriber: **200** max members per party created by subscriber.

### Mobile app (`app/`)

- **Clerk** sign-in (email/password + Google where configured). **Sign in with Apple** disabled for personal-team signing.
- **i18n**: **English, German, Spanish, Croatian** — language persists (AsyncStorage), overrides device locale when set in **Settings**.
- **Home**: Venue detection, access, challenges, **PLAY** → word flow, **XP / tier**, nav to Challenges / Leaderboard / Profile / Settings; **partner card** (**featured offer**, **Order** / **Menu** links from `public-card`, friend visit aggregate, **badges** / visits-this-week from **engagement**); **quick links** (Parties, Who’s here, Redeem invite, **Daily word**, **Redeem perk**); **venue feed** (“At this venue”) when unlocked; **weekly** challenges labeled in copy; **presence** → `POST /social/me/presence` when detected venue changes. **Global venue presence heartbeat** (every ~5 min + on app foreground) while signed in keeps geofence presence updated on the server for **any** screen so **dwell‑based venue nudges** measure time **at the venue in general**, not time in a match. **Tap** on **`venue_order_nudge`** opens **ordering/menu** URL when present, then **Home**.
- **Daily word** screen: **Global** vs **Venue** scope (venue requires detection), guesses via API, streak display; deck **language** follows app locale.
- **Parties**: list/create, party detail (leader: **kick**, **transfer leadership**, share invite via **Share sheet**, mesh friend-requests, leave).
- **Redeem invite**: paste token or **`cafesocial://redeem?token=...`** (linking configured).
- **Redeem perk**: venue staff codes via **`POST /venue-context/:venueId/perks/redeem`** (presence + optional QR-gated perks); response includes **staff verification code** for the staff portal list.
- **Who’s here**: list for current venue (privacy rules).
- **Leaderboard**: tabs for **this venue**, **city**, **country**, and **global** summed XP (uses detected venue’s `city` / `country` where needed).
- **Settings**: Language, **privacy toggles** (discoverable / total privacy), **push buckets** (**word match** vs **partner marketing**), **Legal & data** (summary + links to policy/terms when env URLs are set), about, **Sign out**.
- **Word game**: Solo / **co-op** / **versus** (room code, host starts), difficulty, deck language follows app locale with **EN fallback**; challenge progress when rules allow. **Socket.IO** `/word-match` with **reconnecting** banner; **Expo push** + **tap notification** opens the word match (**wait** or **game**) when possible.
- **QR unlock**: **`expo-camera`** QR scan (native) + manual venue UUID; supports raw UUID, `/venue/<uuid>`, query `venueId`, `cafesocial://…`, JSON `{ venueId }`.
- **Challenges**: list + progress (+1) with refetch.
- **Profile**: server summary (includes `playerId`, XP, tier); **share friend invite** (same as Settings).
- **Friends**: **add by username**, cancel **outgoing** requests, incoming + **Accept**, **share invite** from the screen.
- **Staff mode** (Clerk users on **`VenueStaff`**): **Settings → Staff mode** — list assigned venues, **UTC-day** perk redemptions (`GET /owner/venues/.../redemptions`), **filter**, **QR scan** / manual code (8-char code or redemption UUID / JSON payload) to highlight the row.
- **Receipt proof (JWT)**: `POST /venue-context/:venueId/receipts` `{ imageData (data URL base64), mimeType?, notePlayer?, detectedVenueId? }` — same presence rule as perks; **90-day** `retentionUntil` target. Owners: `GET /owner/venues/:venueId/receipts`, `GET .../receipts/:id` (includes image), `POST .../receipts/:id/review` `{ status: APPROVED|REJECTED, staffNote?, abuseFlag? }`.
- **Redemption audit**: `POST /owner/venues/:venueId/redemptions/:redemptionId/acknowledge` (**EMPLOYEE**+), `POST .../void` (**MANAGER**+, `{ reason }`). Voided rows excluded from active analytics counts; CSV export includes void/ack columns.
- **Owner analytics v2** (same `GET /owner/venues/:venueId/analytics`): **per-perk** counts, **hour-of-day** (UTC + optional venue **IANA** timezone from `Venue.analyticsTimeZone`, set in Partner CMS), **funnel** (unique visitors vs redeemers), **voided** count. **`GET .../analytics/export.csv`** — redemptions CSV (**MANAGER**+).
- **Campaigns**: `VenueCampaign` + `VenueCampaignSend` log; **`GET/POST /owner/venues/:venueId/campaigns`**, **`POST .../campaigns/:id/send`** — targets players with a **visit day** at that venue in the last **segmentDays** (UTC day keys); **Expo push** via `partner_marketing` channel (**`partnerMarketingPush` and not `totalPrivacy`**). Re-send after **FAILED** clears prior send rows.

### Not done yet (good next steps)

- **EAS** production builds, App Store / Play Store assets.
- **Background dwell without foreground app** is platform-limited; today presence relies on **app-open / heartbeat** (and geofence detection when the app runs). A future option is **native geofence callbacks** (Expo task / region monitoring) plus server-side jobs — expect **approximate** dwell unless the OS delivers reliable exit/enter events.

### Realtime word matches (Socket.IO)

- App connects to the **HTTP origin** of `EXPO_PUBLIC_API_URL` (strip `/api`), namespace **`/word-match`**, path **`/socket.io/`**. JWT in `auth.token`; **`subscribe`** `{ sessionId }`; server **`refresh`** on state changes.
- **Scale-out**: set **`REDIS_URL`** (e.g. `redis://localhost:6379`) on the API — Nest uses the **Redis Socket.IO adapter** so `io.to('match:…')` works across multiple Node processes. Without `REDIS_URL`, rooms stay in-memory (single instance).

### Backend tests

```bash
cd backend && npm test
```

## Prerequisites

- **Node.js** (LTS)
- **PostgreSQL** (local or hosted)
- **Clerk** app with native publishable key + (optional) Google OAuth

## Backend setup

```bash
cd backend
cp .env.example .env   # if present; else create .env with DATABASE_URL, etc.
# DATABASE_URL=postgresql://USER@localhost:5432/cafe-social

npm install
npx prisma migrate dev
npx prisma db seed     # if seed is configured
npm run start:dev      # default http://localhost:3001/api
```

**Optional Redis** (multi-instance Socket.IO): `REDIS_URL=redis://127.0.0.1:6379` — e.g. `docker run -p 6379:6379 redis:7-alpine`.

## App setup

```bash
cd app
cp .env.example .env     # EXPO_PUBLIC_CLERK_*, EXPO_PUBLIC_API_URL (e.g. http://LOCAL_IP:3001/api)
npm install

# Align native module versions with Expo SDK 54
npx expo install i18next react-i18next expo-localization @react-native-async-storage/async-storage expo-location expo-camera
```

**Physical device**: `EXPO_PUBLIC_API_URL` must use your machine’s **LAN IP**, not `localhost`.

**Store / privacy (Settings in-app)** — Set **`EXPO_PUBLIC_PRIVACY_POLICY_URL`** and optionally **`EXPO_PUBLIC_TERMS_OF_SERVICE_URL`** to your hosted legal pages. The app also shows a short in-app summary (location + notifications). iOS permission strings are in **`app.config.js`** (`NSLocationWhenInUseUsageDescription`, camera, etc.); keep them aligned with your real policy before review.

Development build (with native modules):

```bash
npx expo prebuild -p ios
npx expo run:ios --device
```

After first install on iPhone: **Settings → General → VPN & Device Management → Trust** your developer app.

### iOS troubleshooting (signing / provisioning)

If **`expo run:ios`** / **`xcodebuild`** fails with **“No profiles for `com.….` were found”** and **“Automatic signing is disabled”**:

1. **Use the workspace** — Open **`app/ios/CafeSocial.xcworkspace`** (not `.xcodeproj`).
2. **Xcode → Settings → Accounts** — Add your **Apple ID** (free or paid developer).
3. **Target `CafeSocial` → Signing & Capabilities** — Turn on **Automatically manage signing**, pick your **Team**. If the bundle ID isn’t registered yet, Xcode will offer to create it.
4. **CLI from the repo** — After the account works in Xcode once, you can try:
   ```bash
   cd app && npx expo run:ios --device -- -allowProvisioningUpdates
   ```
   (`npm run ios:device` if you use the script in `app/package.json`.)
5. **Wrong team in git** — If `DEVELOPMENT_TEAM` in `ios/…/project.pbxproj` is **not** your team, change it in Xcode (or replace with your 10-character Team ID from [developer.apple.com](https://developer.apple.com/account)).
6. **Simulator (no device profile)** — For quick JS/native iteration without a physical device profile:
   ```bash
   cd app && npx expo run:ios --simulator
   ```

### iOS troubleshooting (location / native modules)

- **`Cannot find native module 'ExpoLocation'`** — The installed app was built without `expo-location`. From `app/`: run `npx pod-install` (or `cd ios && pod install`), then **`npx expo run:ios --device`** again so the binary includes **ExpoLocation**.
- **Same for `ExpoCamera`** after adding `expo-camera` — run **`pod install`** and rebuild the dev client.
- **`expo-notifications`** — after adding the plugin, run **`npx expo prebuild -p ios`** (or `run:ios`) so **push** entitlements / capabilities are applied; use a **physical device** for real push tokens.
- **Crash when requesting location / “missing usage descriptions”** — Add **`NSLocationWhenInUseUsageDescription`** to **`ios/CafeSocial/Info.plist`** (and keep the same string under `expo.ios.infoPlist` in **`app.config.js`** so future `expo prebuild` merges it). Rebuild the app after changing the plist.
- **Camera for QR** — **`NSCameraUsageDescription`** is set in **`app.config.js`** / plist; rebuild iOS after changes.

Apply DB migrations (including word match + **`PlayerExpoPushToken`** + **daily word / feed / weekly challenges** + **venue order nudge** fields) and re-seed for words: `cd backend && npx prisma migrate deploy && npx prisma db seed`.

### Admin app (`admin/`)

```bash
cd admin && npm install && npm run dev
# Docker: docker build -t cafe-social-admin . && docker run -p 3000:3000 cafe-social-admin
```

**Clerk-only** sign-in (`/sign-in`). **Super admins** see **CMS** (`/venues`, `/words`, …) when **`Player.platformRole`** is **`SUPER_ADMIN`** in Postgres (set via **`npx prisma studio`**, a migration/seed, or SQL — after that user has a `Player` row, e.g. first sign-in). Example:

```sql
UPDATE "Player" SET "platformRole" = 'SUPER_ADMIN' WHERE LOWER(email) = LOWER('you@yourcompany.com');
```

**Venue staff** use **`/owner/venues`** and **`/staff/[venueId]`** (JWT redemptions). Env: **`NEXT_PUBLIC_API_URL`**, **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`**, **`CLERK_SECRET_KEY`** (same Clerk app as mobile).

## Environment variables (app)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_API_URL` | API base including `/api` |
| `EXPO_PUBLIC_CLERK_GOOGLE_*` | Optional Google sign-in |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | **Expo push**: EAS project UUID (from `eas project:info`) so `getExpoPushTokenAsync` works in dev/production builds |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | **Store / Settings**: link to your privacy policy |
| `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` | Optional link to terms of service |

## Environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | If set, Socket.IO uses **@socket.io/redis-adapter** for cross-process rooms |
| `EXPO_ACCESS_TOKEN` | Optional **Expo push** [access token](https://docs.expo.dev/push-notifications/sending-notifications/) for higher rate limits / security |
| `VENUE_ORDER_NUDGE_ENABLED` | `false` disables dwell-based “order a drink” pushes (default on if unset) |
| `VENUE_ORDER_NUDGE_AFTER_MINUTES` | Minutes at same venue before first nudge per visit (default **30**) |
| `VENUE_ORDER_NUDGE_TITLE` | Default notification title; `{{venueName}}` optional |
| `VENUE_ORDER_NUDGE_BODY` | Default body; `{{venueName}}` recommended |

## License

Private / all rights reserved unless you add a license file.
