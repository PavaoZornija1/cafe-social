# Staging / production stack — Cafe Social

Single reference for **what we use**, **where it lives**, and **how pieces connect**.

> **Secrets:** full credentials in [`STAGING_STACK.secrets.local.md`](./STAGING_STACK.secrets.local.md) (gitignored via [`docs/.gitignore`](./.gitignore) — never commit).

Last updated: June 2026

---

## Architecture

```
[Expo app] ──HTTPS/WSS──► [Railway Nest API] ──► [Supabase Postgres]
[Next admin @ Vercel] ──HTTPS──► [Railway Nest API]
                              └── Clerk (auth, all clients)
```

**Planned later:** migrate API from Railway → **Oracle Always Free VM** when Ampere capacity is available ([`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md)).

---

## Live URLs

| Service | URL | Notes |
|---------|-----|--------|
| **API (Railway)** | https://cafe-social-production.up.railway.app | Health: `/api/health` |
| **API base (clients)** | https://cafe-social-production.up.railway.app/api | Use this in Vercel + EAS |
| **Admin (Vercel)** | https://cafe-social-omega.vercel.app | Next.js partner portal |
| **GitHub repo** | https://github.com/PavaoZornija1/cafe-social | Monorepo |

---

## Tools & dashboards

| Tool | Purpose | Dashboard |
|------|---------|-----------|
| **Supabase** | Hosted PostgreSQL | https://supabase.com/dashboard/project/hhauytryloschyjqjbmj |
| **Railway** | Nest API + Socket.IO (interim) | https://railway.com |
| **Vercel** | Next.js admin | https://vercel.com/dashboard |
| **Clerk** | Auth (app + admin + API JWT) | https://dashboard.clerk.com |
| **Expo / EAS** | Mobile builds | https://expo.dev |
| **Oracle Cloud** | Free VM (future API host) | https://cloud.oracle.com — Frankfurt, Ampere pending capacity |

### Not configured yet (optional)

| Tool | Purpose | When to add |
|------|---------|-------------|
| **Upstash Redis** | Socket.IO multi-instance | Second API instance |
| **Resend** | Transactional email | Friend/party invite emails |
| **Stripe** | Partner billing | SaaS checkout in admin |
| **RevenueCat** | Mobile subscriptions | In-app premium |

---

## Supabase

| Item | Value |
|------|--------|
| **Project ref** | `hhauytryloschyjqjbmj` |
| **Region** | EU Central (Frankfurt) |
| **Runtime URL** | Transaction pooler, port **6543**, `?pgbouncer=true` → `DATABASE_URL` |
| **Migrate / seed URL** | Session pooler, port **5432** → `DIRECT_DATABASE_URL` |
| **Host** | `aws-1-eu-central-1.pooler.supabase.com` |

Pooler URLs (not direct `db.*.supabase.co`) — IPv4-friendly.

**Local CLI:**

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

---

## Clerk

| Item | Value |
|------|--------|
| **Frontend API** | https://pleased-hippo-39.clerk.accounts.dev |
| **Publishable key** | `pk_test_…` (same in admin + app — see secrets file) |
| **Secret key** | `sk_test_…` (backend + Vercel server — see secrets file) |

**Redirect URLs / allowed origins must include:**

- `https://cafe-social-omega.vercel.app`
- `http://localhost:3000` (local admin dev)

---

## Environment variables by host

### Railway (backend service)

Root directory: `backend`. Do **not** set `PORT` (Railway injects it).

| Variable | Staging value |
|----------|----------------|
| `DATABASE_URL` | Supabase pooler **6543** |
| `DIRECT_DATABASE_URL` | Supabase pooler **5432** |
| `CLERK_SECRET_KEY` | Clerk secret |
| `CLERK_AUTHORIZED_PARTIES` | `http://localhost:3000,https://cafe-social-omega.vercel.app` |
| `ADMIN_PORTAL_ORIGIN` | `https://cafe-social-omega.vercel.app` |
| `PARTNER_PORTAL_BASE_URL` | `https://cafe-social-omega.vercel.app` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |

Templates: [`deploy/railway/.env.example`](../deploy/railway/.env.example)

### Vercel (admin — root `admin/`)

| Variable | Staging value |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret |
| `NEXT_PUBLIC_API_URL` | `https://cafe-social-production.up.railway.app/api` |

Region: Frankfurt (`admin/vercel.json`).

### Local dev

| Path | File |
|------|------|
| Backend | `backend/.env` |
| Admin | `admin/.env.local` |
| Mobile | `app/.env` |

---

## Mobile (EAS staging)

When building for staging against Railway:

```bash
cd app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://cafe-social-production.up.railway.app/api"
eas build --profile staging --platform ios
```

---

## Super admin access

After first Clerk sign-in on admin, grant CMS access in Supabase:

```sql
UPDATE "Player"
SET "platformRole" = 'SUPER_ADMIN'
WHERE email = 'your-email@example.com';
```

---

## Deploy docs in repo

| Doc | Topic |
|-----|--------|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Overview |
| [`DEPLOYMENT_RAILWAY.md`](./DEPLOYMENT_RAILWAY.md) | Railway API |
| [`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md) | Oracle VM (future) |
| [`GETTING_STARTED.md`](../GETTING_STARTED.md) | Local dev |

---

## Verification checklist

- [ ] https://cafe-social-production.up.railway.app/api/health → `{"status":"ok"}`
- [ ] https://cafe-social-omega.vercel.app loads; Clerk sign-in works
- [ ] Admin network calls hit `cafe-social-production.up.railway.app/api`
- [ ] Super admin role set for your user in Supabase
- [ ] (Optional) Mobile EAS build with staging API URL

---

## Security notes

1. **Rotate Supabase DB password** if it was ever pasted in chat or committed.
2. Never commit `backend/.env`, `admin/.env.local`, or `STAGING_STACK.secrets.local.md`.
3. Clerk **secret** keys only on server (Railway, Vercel server env) — never in Expo client.
