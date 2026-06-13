# Deployment — Railway (Nest API, trial / interim)

Host the **backend** on [Railway](https://railway.com) using **`backend/Dockerfile`**. Use this while waiting for Oracle Ampere capacity, or as a ~$5/mo Hobby host later.

Keep **Supabase** (database) and **Vercel** (admin) as-is.

```
[Expo app] ──HTTPS/WS──► [Railway Web Service] ──► [Supabase Postgres]
[Vercel admin] ──HTTPS──► [Railway Web Service]
```

---

## Trial vs paid

| Stage | Cost | Notes |
|-------|------|--------|
| **Trial** (new account) | $0 | **$5 credit** for ~30 days — enough for staging |
| **Free plan** (after trial) | $0 | **$1/month** credit — too tight for production API |
| **Hobby** | **$5/mo** | Recommended if you stay on Railway after trial |

Railway does **not** sleep idle services like Render free tier — good for **Socket.IO**.

---

## Prerequisites

1. **Push deploy files to GitHub** — Railway builds from the repo. At minimum:

   - `backend/Dockerfile`
   - `backend/docker-entrypoint.sh`
   - `backend/railway.toml`
   - `backend/prisma.config.ts`

2. Supabase migrated + seeded (see [`DEPLOYMENT.md`](./DEPLOYMENT.md) §1).

3. Vercel admin deployed (note the URL for env vars).

---

## 1. Create the Railway project

1. Sign up at [railway.com](https://railway.com) (GitHub login).
2. **New Project** → **Deploy from GitHub repo** → `PavaoZornija1/cafe-social`.
3. When the service is created, open **Settings**:
   - **Root Directory:** `backend`
   - **Builder:** Dockerfile (auto-detected from `backend/railway.toml`)
4. **Settings → Networking → Generate Domain**  
   Example: `https://cafe-social-api-production.up.railway.app`

Your API base URL (include `/api` suffix for clients):

```
https://YOUR-SERVICE.up.railway.app/api
```

Health:

```
https://YOUR-SERVICE.up.railway.app/api/health
```

5. **Settings → Deploy → Region:** pick **EU** (closest to Frankfurt / Supabase).

---

## 2. Environment variables

**Variables** tab → **Raw Editor** — paste from [`deploy/railway/.env.example`](../deploy/railway/.env.example).

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Supabase transaction pooler (**6543**) + `?pgbouncer=true` |
| `DIRECT_DATABASE_URL` | Supabase session pooler (**5432**) |
| `CLERK_SECRET_KEY` | Same as local `backend/.env` |
| `CLERK_AUTHORIZED_PARTIES` | `http://localhost:3000,https://YOUR-ADMIN.vercel.app` |
| `ADMIN_PORTAL_ORIGIN` | Vercel admin URL |
| `PARTNER_PORTAL_BASE_URL` | Same as admin URL |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |

Do **not** set `PORT` — Railway injects it.

After first deploy, redeploy if you change variables (**Deployments → Redeploy**).

---

## 3. Deploy

Railway deploys on push to the connected branch (usually `main`).

Watch **Deployments** → build logs. On success:

```bash
curl https://YOUR-SERVICE.up.railway.app/api/health
```

Expected: `{"status":"ok"}`

Migrations run on container start (`backend/docker-entrypoint.sh`).

---

## 4. Wire Vercel + Clerk

**Vercel** → Environment variables:

```
NEXT_PUBLIC_API_URL=https://YOUR-SERVICE.up.railway.app/api
```

Redeploy admin.

**Clerk** → Redirect URLs / allowed origins:

- `https://YOUR-ADMIN.vercel.app`

Ensure `CLERK_AUTHORIZED_PARTIES` on Railway includes that exact URL.

---

## 5. Mobile (optional)

```bash
cd app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://YOUR-SERVICE.up.railway.app/api"
eas build --profile staging --platform ios
```

---

## 6. Switch to Oracle later

When Ampere capacity is available:

1. Deploy API on Oracle VM (see [`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md)).
2. Update **Vercel** `NEXT_PUBLIC_API_URL` to the Oracle URL.
3. Update **EAS** `EXPO_PUBLIC_API_URL`.
4. Update **Clerk** if origins change.
5. Pause or delete the Railway service to stop trial usage.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails — Dockerfile not found | Set **Root Directory** = `backend` |
| Health check fails | Logs → check migrate errors; verify `DIRECT_DATABASE_URL` (5432 pooler) |
| Clerk JWT / 401 | Add exact Vercel URL to `CLERK_AUTHORIZED_PARTIES`; redeploy |
| WebSocket issues | Use `wss://` when API is HTTPS; Railway supports upgrades |
| Trial credit running low | Dashboard → Usage; resize to 512MB RAM if needed |

---

## Related

- Supabase + seed: [`DEPLOYMENT.md`](./DEPLOYMENT.md) §1
- Oracle (free long-term): [`DEPLOYMENT_ORACLE.md`](./DEPLOYMENT_ORACLE.md)
