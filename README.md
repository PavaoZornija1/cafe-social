# Cafe Social

**Location-aware social gaming for cafés and other physical venues.** Players unlock challenges and games when they’re at a partner venue (geofenced). This repo is the Cafe Social monorepo: **NestJS + Prisma** backend and **Expo (React Native)** mobile app.

## Repo layout

| Path | Description |
|------|-------------|
| `backend/` | NestJS API (`/api`), PostgreSQL via Prisma, Clerk JWT auth |
| `app/` | Expo SDK 54 app (iOS/Android), Clerk, React Navigation |

## What’s implemented

### Backend (`backend/`)

- **Auth**: Protected routes validate **Clerk JWTs**. Users are resolved to a `Player` via email (or `sub@clerk.local` when email is absent).
- **Venues**: CRUD + **geofence detection** — `GET /venue-context/detect` with optional `?lat=&lng=` selects a venue whose `latitude` / `longitude` / `radiusMeters` contains the point (Haversine). Without coordinates, falls back to a **default venue** (dev / simulator friendly).
- **Access**: `GET /venue-context/:venueId/access` — premium vs QR unlock vs subscription rules for entering a venue’s **context**.
- **QR / unlock**: `POST /venue-context/:venueId/register` — links `PlayerVenue` after “scan” (app currently uses manual venue id).
- **Challenges**: List + `POST …/progress` with **server rules** (`locationRequired`, `rewardVenueSpecific`, premium + QR exceptions).
- **Words**: `GET /words/session` — random word deck with sentence / word / emoji hints.
- **Player summary**: `GET /players/me/summary` — **global XP** = **sum of per-venue XP** (`PlayerVenueStats`); tier from that sum; **`playerId`** for client UI; challenge/venue counts; privacy flags `discoverable`, `totalPrivacy`.
- **Player settings**: `PATCH /players/me/settings` — `{ discoverable?, totalPrivacy? }` (JWT).
- **Per-venue XP**: earned on **challenge progress** at that venue (+10 per increment, +50 on first completion).
- **Venues**: `city`, `country`, `region` on venue model + CRUD DTOs; seed sets example geo for default venues.
- **Venue XP leaderboard**: `GET /venues/:venueId/leaderboard/xp` — top players by stored venue XP.
- **Social / presence**: `POST /social/me/presence` — `{ venueId }` or clear with `venueId: null`; `GET /social/venues/:venueId/people-here` — discoverability rules (friends stub if not public discoverable; strangers only if `discoverable`; `totalPrivacy` excludes); `GET /social/discover/subscribers` — **subscription-only**: lists other subscribers who are discoverable (remote layer).
- **Friends**: `GET /social/friends`, `GET /social/friends/incoming`, `POST /social/friends/request`, `POST /social/friends/accept`.
- **Invites**: `POST /invites/friend-link` — create friend invite token (rate limits); `POST /invites/redeem` `{ token }` — party or friend link (party: join + accepted friendship with **party creator**; friend-only: accepted friendship with link creator). Link TTL **24h**; daily link budget **4** (free) / **10** (subscriber UTC day); `maxUses` = party max size (**4** / **200**). **Use count increments** only for a **new** party join or **new** friendship via that link.
- **Parties** (JWT): `POST /parties`, `GET /parties/mine`, `GET /parties/:partyId`, `POST .../leave`, `POST .../transfer-leadership`, `POST .../kick`, `POST .../invite-friend` (must already be friends), `POST .../invite-link` (**leader only**), `POST .../revoke-invite-link`, `POST .../mesh-friend-requests`. **creatorId** fixed; **leaderId** has kick/link powers; transferring leadership removes creator’s powers unless they are leader again; **random new leader** if leader leaves; **empty party deleted**. Free tier: **2 created parties**, **4** max members each; subscriber: **200** max members per party created by subscriber.

### Mobile app (`app/`)

- **Clerk** sign-in (email/password + Google where configured). **Sign in with Apple** disabled for personal-team signing.
- **i18n**: **English, German, Spanish, Croatian** — language persists (AsyncStorage), overrides device locale when set in **Settings**.
- **Home**: Venue detection, access, challenges, **PLAY** → word flow, **XP / tier**, nav to Challenges / Leaderboard / Profile / Settings; **quick links** (Parties, Who’s here, Redeem invite); **presence** → `POST /social/me/presence` when detected venue changes.
- **Parties**: list/create, party detail (leader: share invite via **Share sheet**, mesh friend-requests, leave).
- **Redeem invite**: paste token or **`cafesocial://redeem?token=...`** (linking configured).
- **Who’s here**: list for current venue (privacy rules).
- **Leaderboard**: per-venue **XP** ranking for the **detected** café.
- **Settings**: Language, **privacy toggles** (discoverable / total privacy), about, **Sign out**.
- **Word game**: Difficulty (easy / normal / hard), session deck from API, challenge progress on session complete.
- **Challenges**: list + progress (+1) with refetch.
- **Profile**: server summary (includes `playerId`, XP, tier).

### Not done yet (good next steps)

- Camera **QR** scanning (stable path: `expo-camera` barcodes, not `expo-barcode-scanner`).
- **Co-op / versus** modes and realtime sessions.
- **Friends** screen: list + incoming requests + **Accept**; **Profile** / **Settings** → share **friend invite** link (`POST /invites/friend-link`).
- **Party detail**: **Kick** members (leader), **Transfer leadership** (picker sheet).
- City / country / global XP ladders (geo on venue + `PlayerVenueStats` ready).
- **EAS** production builds, App Store / Play Store assets.

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

## App setup

```bash
cd app
cp .env.example .env     # EXPO_PUBLIC_CLERK_*, EXPO_PUBLIC_API_URL (e.g. http://LOCAL_IP:3001/api)
npm install

# Align native module versions with Expo SDK 54
npx expo install i18next react-i18next expo-localization @react-native-async-storage/async-storage expo-location
```

**Physical device**: `EXPO_PUBLIC_API_URL` must use your machine’s **LAN IP**, not `localhost`.

Development build (with native modules):

```bash
npx expo prebuild -p ios
npx expo run:ios --device
```

After first install on iPhone: **Settings → General → VPN & Device Management → Trust** your developer app.

## Environment variables (app)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `EXPO_PUBLIC_API_URL` | API base including `/api` |
| `EXPO_PUBLIC_CLERK_GOOGLE_*` | Optional Google sign-in |

## License

Private / all rights reserved unless you add a license file.
