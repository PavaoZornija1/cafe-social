# Staging / production stack — Cafe Social

Single reference for **what we use**, **where it lives**, and **how pieces connect**.

> **Secrets:** full credentials in [`STAGING_STACK.secrets.local.md`](./STAGING_STACK.secrets.local.md) (gitignored via [`docs/.gitignore`](./.gitignore) — never commit).

Last updated: August 2026

---

## Architecture

```
[Expo app] ──HTTPS/WSS──► [api.cafe-social.com — Nest on Hetzner] ──► [Supabase Postgres]
[Partner portal @ partner.cafe-social.com] ──HTTPS──► [api.cafe-social.com]
                                                    └── Redis (Docker on VPS)
                              └── Clerk (auth, all clients)
```

Deploy: GitHub Actions → Hetzner (`deploy-api.yml`); Vercel → `admin/` on `main`.

---

## Live URLs

| Service | URL | Notes |
|---------|-----|--------|
| **API** | https://api.cafe-social.com | Health: `/api/health` |
| **API base (clients)** | https://api.cafe-social.com/api | Vercel + EAS |
| **Partner portal** | https://partner.cafe-social.com | Next.js (`admin/`); redirects from `cafe-social-omega.vercel.app` |
| **GitHub repo** | https://github.com/PavaoZornija1/cafe-social | Monorepo |

---

## Tools & dashboards

| Tool | Purpose | Dashboard |
|------|---------|-----------|
| **Supabase** | Hosted PostgreSQL | https://supabase.com/dashboard/project/hhauytryloschyjqjbmj |
| **Hetzner** | Nest API + Caddy + Redis | Cloud console → CX23 Nuremberg |
| **Vercel** | Partner portal | https://vercel.com/pzornijas-projects/cafe-social |
| **Clerk** | Auth (app + admin + API JWT) | https://dashboard.clerk.com |
| **Expo / EAS** | Mobile builds | https://expo.dev |
| **Cloudflare** | DNS for `cafe-social.com` | Zone DNS |
| **Stripe** | Partner SaaS + PPV (test mode) | https://dashboard.stripe.com |
| **RevenueCat** | Guest Pro (Test Store until ASC) | https://app.revenuecat.com |

### Optional later

| Tool | Purpose | When to add |
|------|---------|-------------|
| **Resend** | Transactional email | Friend/party invite emails |
| **App Store / Play** | Real IAP (replace RC Test Store) | After Apple Developer enrollment |

---

## Supabase

| Item | Value |
|------|--------|
| **Project ref** | `hhauytryloschyjqjbmj` |
| **Region** | EU Central (Frankfurt) |
| **Runtime URL** | Transaction pooler, port **6543**, `?pgbouncer=true` → `DATABASE_URL` |
| **Migrate / seed URL** | Session pooler, port **5432** → `DIRECT_DATABASE_URL` |
| **Host** | `aws-1-eu-central-1.pooler.supabase.com` |

Pooler URLs (not direct `db.*.supabase.co`) — IPv4-friendly from the VPS.

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

- `https://partner.cafe-social.com`
- `https://cafe-social-omega.vercel.app` (legacy redirect host)
- `http://localhost:3000` (local admin dev)

---

## Environment variables by host

### Hetzner VPS (`/opt/cafe-social/deploy/oracle/.env`)

Compose: Caddy + Nest + Redis. Template: [`deploy/oracle/.env.example`](../deploy/oracle/.env.example)

| Variable | Staging value |
|----------|----------------|
| `API_DOMAIN` | `api.cafe-social.com` |
| `DATABASE_URL` | Supabase pooler **6543** |
| `DIRECT_DATABASE_URL` | Supabase session pooler **5432** |
| `REDIS_URL` | `redis://redis:6379` (set by compose) |
| `GAME_RUNTIME_REQUIRE_REDIS` | `1` |
| `BRAWLER_FORFEIT_IDLE_MS` | `30000` (optional; input-idle auto-forfeit grace) |
| `CLERK_SECRET_KEY` | Clerk secret |
| `CLERK_AUTHORIZED_PARTIES` | portal + API + localhost origins |
| `ADMIN_PORTAL_ORIGIN` | `https://partner.cafe-social.com` |
| `PARTNER_PORTAL_BASE_URL` | `https://partner.cafe-social.com` |
| `NODE_ENV` | `production` |
| `STRIPE_SECRET_KEY` | Stripe test secret |
| `STRIPE_PUBLISHABLE_KEY` | Stripe test publishable |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook endpoint |
| `STRIPE_PARTNER_PRICE_ID` | `price_1U7HVZB5x0B8YBlYJno33XTZ` (€49/mo) |
| `STRIPE_PPV_METERED_PRICE_ID` | `price_1U7HWYB5x0B8YBlYCzi3d7qf` (€0.50/visit) |
| `STRIPE_PPV_USAGE_REPORTING_ENABLED` | `true` |
| `REVENUECAT_ENTITLEMENT_ID` | `Cafe Social Pro` |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Must match RC webhook Authorization header |
| `REVENUECAT_SECRET_API_KEY` | RC secret API key (REST sync; set in dashboard if missing) |

### Vercel (admin — root `admin/`)

| Variable | Staging value |
|----------|----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret |
| `NEXT_PUBLIC_API_URL` | `https://api.cafe-social.com/api` |

Region: Frankfurt (`admin/vercel.json`).

### Local dev

| Path | File |
|------|------|
| Backend | `backend/.env` |
| Admin | `admin/.env.local` |
| Mobile | `app/.env` |

---

## Mobile (EAS staging)

```bash
cd app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.cafe-social.com/api"
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
| [`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md) | VPS / Docker API (`deploy/oracle/`) |
| [`GETTING_STARTED.md`](../GETTING_STARTED.md) | Local dev |

---

## Verification checklist

- [ ] https://api.cafe-social.com/api/health → `{"status":"ok"}`
- [ ] https://partner.cafe-social.com loads; Clerk sign-in works
- [ ] Admin network calls hit `api.cafe-social.com/api`
- [ ] Super admin role set for your user in Supabase
- [ ] (Optional) Mobile EAS build with staging API URL

---

## Security notes

1. **Rotate Supabase DB password** if it was ever pasted in chat or committed.
2. Never commit `backend/.env`, `admin/.env.local`, `deploy/oracle/.env`, or `STAGING_STACK.secrets.local.md`.
3. Clerk **secret** keys only on server (VPS, Vercel server env) — never in Expo client.
