# Deployment — production stack (Tier A)

| Piece | Host | Cost |
|-------|------|------|
| **PostgreSQL** | [Supabase](https://supabase.com) | Free / paid as needed |
| **NestJS API + Socket.IO + Redis** | [Hetzner VPS](./DEPLOYMENT_ORACLE.md) (`deploy/oracle/`) | ~€6/mo |
| **Admin / partner portal (Next.js)** | [Vercel](https://vercel.com) | $0 |
| **Redis** | Docker on the same VPS | included |

Supabase is **Postgres only** — Nest + Prisma + Clerk + Socket.IO run on the VPS.

---

## Architecture

```
[Expo app] ──HTTPS/WS──► [api.cafe-social.com — Caddy → Nest] ──► [Supabase Postgres]
[Partner portal @ partner.cafe-social.com] ──HTTPS──► [api.cafe-social.com]
                                              └── Redis (on-box)
```

GitHub Actions deploys the API on pushes that touch `backend/` or `deploy/oracle/` (`.github/workflows/deploy-api.yml`). Vercel deploys the partner portal from `admin/` on `main`.

---

## Quick links

- **Database setup** — §1 below
- **API on Hetzner / VPS** — [`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md) (`deploy/oracle/`)
- **Admin on Vercel** — §2 below
- **Mobile staging** — §3 below

---

## 1. Supabase (database)

1. Create project → region **Frankfurt (eu-central-1)**.
2. Save the database password.
3. **Project Settings → Database → Connection string**:
   - **Transaction pooler** (port **6543**) → `DATABASE_URL` (runtime)
   - **Session pooler** (port **5432**) → `DIRECT_DATABASE_URL` (migrations/seed)
4. Append to pooler URL if missing: `?pgbouncer=true`

Example:

```bash
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
```

Prefer pooler hosts over `db.*.supabase.co` for IPv4-only VPS egress.

### Apply schema + seed (from your Mac)

```bash
cd backend
cp .env.example .env
# Paste DATABASE_URL + DIRECT_DATABASE_URL

npm install
npx prisma migrate deploy
npx prisma db seed
```

Smoke-test locally:

```bash
npm run start:dev
curl http://localhost:3005/api/health
# → {"status":"ok"}
```

---

## 2. Vercel (partner portal)

1. Import GitHub repo → **Root Directory:** `admin`
2. **Framework:** Next.js (auto-detected)
3. **Region:** Frankfurt — `admin/vercel.json`
4. Custom domain: `partner.cafe-social.com`

### Environment variables

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_API_URL` | `https://api.cafe-social.com/api` |

Redeploy after changing `NEXT_PUBLIC_*` env vars.

### Clerk dashboard

Add `https://partner.cafe-social.com` (and local `http://localhost:3000`) to redirect URLs / authorized parties. Mirror those origins in VPS `CLERK_AUTHORIZED_PARTIES`.

---

## 3. Mobile app (staging build)

```bash
cd app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.cafe-social.com/api"
eas build --profile staging --platform ios
```

Profile `staging` is in `app/eas.json`.

---

## Verification checklist

- [ ] `GET https://api.cafe-social.com/api/health` → `{ "status": "ok" }`
- [ ] Partner portal loads; Clerk sign-in works
- [ ] Admin API calls hit `api.cafe-social.com` (network tab)
- [ ] Mobile staging build signs in and loads player summary
- [ ] Word match: two devices connect (WebSocket over HTTPS)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `prisma migrate` fails on pooler | Use session pooler / `DIRECT_DATABASE_URL` (port **5432**), not transaction-only |
| Clerk JWT / authorized parties errors | Add exact portal URL to `CLERK_AUTHORIZED_PARTIES` on the VPS |
| Admin “API URL not set” | Set `NEXT_PUBLIC_API_URL` in Vercel, redeploy without cache |
| WebSocket disconnects | Use `wss://` when API is HTTPS |
| Deploy Action fails on dirty tree | Workflow uses `git reset --hard origin/main`; keep secrets only in `deploy/oracle/.env` |

---

## Related

- Local setup: [`GETTING_STARTED.md`](../GETTING_STARTED.md)
- Env templates: `backend/.env.example`, `deploy/oracle/.env.example`
- Staging live URLs: [`STAGING_STACK.md`](./STAGING_STACK.md)
