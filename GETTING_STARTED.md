# Getting Started — Cafe Social

A short, opinionated checklist to bring the whole monorepo up locally.
For deep API / feature docs see `README.md`. For AI/agent context see `CURSOR.md`.

## Prerequisites

- **Node.js** LTS (≥ 20)
- **PostgreSQL** running locally (or hosted) — used by the backend via Prisma
- **Clerk** application (one app, used by `app/`, `admin/`, and `backend/`)
- For mobile on a real iPhone: **Xcode**, **CocoaPods**, an Apple ID added to Xcode, an iPhone on the same Wi‑Fi as your Mac
- Optional: **Redis** (only needed if you want Socket.IO scale‑out — `docker run -p 6379:6379 redis:7-alpine`)

## Repo layout

| Path     | Stack                                               | Default URL                       |
|----------|-----------------------------------------------------|-----------------------------------|
| `backend/` | NestJS 11 + Prisma 7 + PostgreSQL + Socket.IO     | `http://localhost:3005/api`       |
| `admin/`   | Next.js 15 + Clerk                                | `http://localhost:3000`           |
| `app/`     | Expo SDK 54 + React 19 + Clerk                    | Metro on `:8081`, native build    |

You typically want three terminals running, one per package.

---

## 1. Backend (NestJS API)

```bash
cd backend
cp .env.example .env
# Minimum required values in .env:
#   DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/cafe-social
#   CLERK_SECRET_KEY=sk_test_...
# Optional but useful:
#   CLERK_AUTHORIZED_PARTIES=http://localhost:3000,http://localhost:3001
#   (include the exact origin shown in the browser when you open the admin portal)
#   REDIS_URL=redis://127.0.0.1:6379
# Optional — queue bot-fill (casual matchmaking). Defaults: 10s wait, 1s word bot tick.
#   WORD_QUEUE_BOT_FILL_AFTER_MS=10000
#   BRAWLER_QUEUE_BOT_FILL_AFTER_MS=10000
#   WORD_BOT_TICK_MS=1000

npm install
npx prisma migrate dev          # creates schema and runs the seed (prisma.seed in package.json)
npm run start:dev               # http://0.0.0.0:3005/api  (binds 0.0.0.0 so phones on LAN can hit it)
```

Health check: open `http://localhost:3005/api/health` (or any public route) and confirm a 200/400 response (not connection refused).

To re‑seed words after a migration: `npx prisma migrate deploy && npx prisma db seed`.

To grant yourself super‑admin (after you've signed in once so a `Player` row exists):

```sql
UPDATE "Player" SET "platformRole" = 'SUPER_ADMIN'
WHERE LOWER(email) = LOWER('you@yourcompany.com');
```

Tests: `cd backend && npm test`.

---

## 2. Admin portal (Next.js)

```bash
cd admin
# Create .env.local with:
#   NEXT_PUBLIC_API_URL=http://localhost:3005/api
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
#   CLERK_SECRET_KEY=sk_test_...

npm install
npm run dev                     # http://localhost:3000
```

Sign in at `/sign-in`. Super admins land in the CMS (`/venues`, `/words`, etc.). Venue staff land in `/owner/venues` and `/staff/[venueId]`.

Build & run production locally: `npm run build && npm start`.

---

## 3. Mobile app (Expo)

### Set environment

```bash
cd app
cp .env.example .env
```

Edit `app/.env`:

```ini
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# Simulator OR Mac:    http://localhost:3005/api
# Physical iPhone/Android on Wi‑Fi:    http://<YOUR_MAC_LAN_IP>:3005/api
EXPO_PUBLIC_API_URL=http://localhost:3005/api
```

Find your LAN IP with `ipconfig getifaddr en0`. The phone and Mac must be on the same Wi‑Fi.

### Install JS deps + native modules aligned to Expo SDK 54

```bash
npm install
npx expo install i18next react-i18next expo-localization \
  @react-native-async-storage/async-storage expo-location expo-camera
```

### Run on the iOS Simulator (fastest iteration)

```bash
npm run ios:sim
# same as:
npx expo run:ios
```

Expo SDK 54+ no longer accepts `--simulator`; omitting `-d` / `--device` builds for the iOS Simulator by default.

### Run on a physical iPhone (`--device`)

This is the path you'll use for real geofence / camera / push testing.

```bash
# First time on this machine, OR after adding any native module:
npx expo prebuild -p ios
cd ios && pod install && cd ..

# Plug iPhone in via USB, unlock it, trust the Mac on the phone.
npm run ios:device              # equivalent to: npx expo run:ios --device
```

Notes for `--device`:

- Expo lists connected devices if more than one is attached and asks which to install on.
- After the first install: on the iPhone go to **Settings → General → VPN & Device Management → Trust** your developer profile, then re-launch the app.
- Do **not** pass `-- -allowProvisioningUpdates`. The Expo CLI parses `-p` as Metro's `--port` and fails with `option requires argument … -p`. Expo already forwards `-allowProvisioningUpdates` to `xcodebuild` when it resolves a development team.
- If you change `EXPO_PUBLIC_API_URL`, restart Metro: `npx expo start --clear` (or rebuild from Xcode if JS is embedded).

### iOS signing — quick recovery

If `npm run ios:device` fails with "No profiles for `com.…` were found" / "Automatic signing is disabled":

1. Open `app/ios/CafeSocial.xcworkspace` (the `.xcworkspace`, not `.xcodeproj`).
2. **Xcode → Settings → Accounts** → add your Apple ID.
3. Target **CafeSocial → Signing & Capabilities** → enable **Automatically manage signing**, pick your Team. Xcode will offer to register the bundle id if it's new.
4. Re-run `npm run ios:device` from the repo CLI.
5. If the team in `ios/…/project.pbxproj` doesn't match yours, set the right `DEVELOPMENT_TEAM` in Xcode (your 10-character Team ID from developer.apple.com).

### iOS native module troubleshooting

- `Cannot find native module 'ExpoLocation' / 'ExpoCamera'` → the installed binary was built before that native module was added. Run `cd ios && pod install && cd ..` then `npm run ios:device` again.
- `expo-notifications` capabilities → run `npx expo prebuild -p ios` after adding the plugin, then rebuild. Real push tokens require a physical device.
- Crash on location → ensure `NSLocationWhenInUseUsageDescription` is in `ios/CafeSocial/Info.plist`. The same string is in `app.config.js` so future `expo prebuild` regenerates it.

---

## Common gotchas

- **`localhost` from the phone won't work.** Use the Mac's LAN IP in `EXPO_PUBLIC_API_URL`.
- **Backend binds `0.0.0.0:3005` by default** (see `backend/src/main.ts`) so phones on the same Wi‑Fi can reach it. If your firewall blocks it, allow Node on the private network.
- **Clerk JWKS errors (`no applicable key found in the JSON Web Key Set`)** → set `CLERK_SECRET_KEY` (the API uses `@clerk/backend` `verifyToken`, not raw JWKS). Optionally set `CLERK_JWT_KEY` (PEM from the Clerk dashboard) for networkless verify.
- **Circular module dep:** `PlayerModule ↔ VenueModule` use `forwardRef`. Don't remove it (see `CURSOR.md`).
- **Prisma after schema edits:** `npx prisma migrate dev` locally, `npx prisma migrate deploy` on remote envs, then `npx prisma generate`.

---

## One-liner cheat sheet

```bash
# Terminal 1 — API
cd backend && npm run start:dev

# Terminal 2 — Admin
cd admin && npm run dev

# Terminal 3 — Mobile (real iPhone)
cd app && npm run ios:device
```
