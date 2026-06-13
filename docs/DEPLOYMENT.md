# Deployment — pilot stack

| Piece | Host | Cost |
|-------|------|------|
| **PostgreSQL** | [Supabase](https://supabase.com) | $0 |
| **NestJS API + Socket.IO** | [Railway](https://railway.com) (now) → [Oracle VM](./DEPLOYMENT_ORACLE.md) (later) | Trial / ~$5/mo → $0 |
| **Admin portal (Next.js)** | [Vercel](https://vercel.com) | $0 |
| **Redis** (optional) | [Upstash](https://upstash.com) | $0 — skip until multi-instance API |

Supabase is **Postgres only** — you keep Nest + Prisma + Clerk + Socket.IO.

---

## Architecture

```
[Expo app] ──HTTPS/WS──► [Railway API] ──pooler──► [Supabase Postgres]
[Next admin on Vercel] ──HTTPS──► [Railway API]
```

When Oracle Ampere capacity is available, swap the API host — see [Oracle guide](./DEPLOYMENT_ORACLE.md).

---

## Quick links

- **Database setup** — §1 below
- **API on Railway** — [`DEPLOYMENT_RAILWAY.md`](./DEPLOYMENT_RAILWAY.md)
- **API on Oracle (free long-term)** — [`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md)
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

## 2. Vercel (admin portal)

1. [vercel.com/new](https://vercel.com/new) → import GitHub repo.
2. **Root Directory:** `admin`
3. **Framework:** Next.js (auto-detected)
4. **Region:** Frankfurt — set in `admin/vercel.json`

### Environment variables

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_API_URL` | `https://YOUR-SERVICE.up.railway.app/api` |

Redeploy after changing env vars.

### Clerk dashboard

Add your Vercel admin URL to **Redirect URLs** and ensure it appears in Railway `CLERK_AUTHORIZED_PARTIES`.

---

## 3. Mobile app (staging build)

```bash
cd app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://YOUR-SERVICE.up.railway.app/api"
eas build --profile staging --platform ios
```

Profile `staging` is in `app/eas.json`.

---

## Verification checklist

- [ ] `GET https://<api>/api/health` → `{ "status": "ok" }`
- [ ] Admin loads on Vercel; Clerk sign-in works
- [ ] Admin API calls succeed (network tab → `NEXT_PUBLIC_API_URL`)
- [ ] Mobile staging build signs in and loads player summary
- [ ] Word match: two devices connect (WebSocket over HTTPS)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `prisma migrate` fails on pooler | Use `DIRECT_DATABASE_URL` (port 5432), not transaction pooler |
| Clerk JWT / authorized parties errors | Add exact Vercel URL to `CLERK_AUTHORIZED_PARTIES` on Railway |
| Railway build fails — no Dockerfile | Set **Root Directory** = `backend`; push `backend/Dockerfile` to GitHub |
| Admin “API URL not set” | Set `NEXT_PUBLIC_API_URL` in Vercel, redeploy |
| WebSocket disconnects | Use `wss://` when API is HTTPS; Railway does not sleep on trial |

---

## Related

- Local setup: [`GETTING_STARTED.md`](../GETTING_STARTED.md)
- Env templates: `backend/.env.example`, `deploy/railway/.env.example`, `deploy/oracle/.env.example`
