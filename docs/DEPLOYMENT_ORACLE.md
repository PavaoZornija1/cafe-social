# Deployment — Oracle Cloud Always Free VM (API)

Host the **NestJS API + Socket.IO** on an **Oracle Always Free** Ampere VM. Keep **Supabase** (Postgres) and **Vercel** (admin) as-is.

```
[Expo app] ──HTTPS/WS──► [Oracle VM: Caddy → Docker API] ──► [Supabase Postgres]
[Vercel admin] ──HTTPS──► [Oracle VM API]
```

Files live in [`deploy/oracle/`](../deploy/oracle/).

---

## 1. Create the VM (Oracle Cloud Console)

1. Sign up at [cloud.oracle.com](https://www.oracle.com/cloud/free/) (credit card for verification; Always Free resources stay free).
2. **Create VM instance**
   - **Name:** `cafe-social-api`
   - **Image:** Ubuntu 22.04 or 24.04 (aarch64)
   - **Shape:** **Ampere** `VM.Standard.A1.Flex` — **1 OCPU**, **6 GB RAM** (fits free tier)
   - **Boot volume:** 50 GB default is fine
   - **Networking:** assign a **public IPv4**
   - **SSH key:** paste your Mac’s public key (`~/.ssh/id_ed25519.pub` or generate one)
3. **Security list / ingress rules** (VCN → Security Lists → default):
   - TCP **22** (SSH) — your IP if possible
   - TCP **80** (HTTP)
   - TCP **443** (HTTPS)
4. Note the **public IP** (e.g. `123.45.67.89`).

Optional: Oracle sometimes blocks port 80 on new accounts until you open a support ticket — if HTTP fails externally, check their docs for “port 80 restriction”.

---

## 2. DNS (recommended before HTTPS)

Point a subdomain at the VM IP:

| Type | Name | Value |
|------|------|--------|
| A | `api` (or `api.staging`) | `YOUR_VM_PUBLIC_IP` |

Example API base URL: `https://api.yourdomain.com/api`

**Without a domain:** use [`Caddyfile.http`](../deploy/oracle/Caddyfile.http) for HTTP-only testing (`http://IP/api/health`). iOS/Android and Clerk production flows expect HTTPS later.

---

## 3. First-time VM setup (SSH)

```bash
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

Install Docker:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and SSH back in so `docker` works without `sudo`.

Clone the repo:

```bash
git clone git@github.com:PavaoZornija1/cafe-social.git
cd cafe-social/deploy/oracle
```

---

## 4. Configure environment

```bash
cp .env.example .env
nano .env   # paste Supabase URLs, Clerk, Vercel admin URL
```

Set **`API_DOMAIN`** in `.env` to match DNS (e.g. `api.yourdomain.com`). Caddy reads it from the environment for automatic HTTPS.

**HTTP-only (no domain yet):**

```bash
cp Caddyfile.http Caddyfile
```

Then skip `API_DOMAIN` until you add a domain and switch back to the default `Caddyfile`.

---

## 5. Deploy

```bash
docker compose up -d --build
docker compose logs -f api
```

Health check:

```bash
curl http://YOUR_VM_IP/api/health
# or with domain:
curl https://api.yourdomain.com/api/health
```

Expected: `{"status":"ok"}`

Migrations run automatically on container start (`backend/docker-entrypoint.sh`).

---

## 6. Wire Vercel + Clerk

**Vercel** → Environment variables:

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

Redeploy admin.

**Clerk** → add to redirect URLs / authorized parties:

- `https://YOUR-ADMIN.vercel.app`
- API domain if needed

**`.env` on VM** — ensure:

```
CLERK_AUTHORIZED_PARTIES=...,https://YOUR-ADMIN.vercel.app
ADMIN_PORTAL_ORIGIN=https://YOUR-ADMIN.vercel.app
PARTNER_PORTAL_BASE_URL=https://YOUR-ADMIN.vercel.app
```

Restart API after env changes:

```bash
docker compose up -d --force-recreate api
```

---

## 7. Updates

On the VM:

```bash
cd ~/cafe-social
./deploy/oracle/update.sh
```

Or manually: `git pull && cd deploy/oracle && docker compose up -d --build`

---

## 8. Mobile (EAS)

```bash
cd app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.yourdomain.com/api"
eas build --profile staging --platform ios
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `curl` to IP times out | Oracle security list + Ubuntu `ufw` (`sudo ufw allow 80,443/tcp`) |
| Build fails on ARM | Dockerfile uses `node:22-alpine` (multi-arch) — rebuild on VM, don’t copy x86 images |
| Migrate fails | `DIRECT_DATABASE_URL` must be session pooler (5432), not transaction (6543) |
| Clerk JWT errors | Add exact Vercel URL to `CLERK_AUTHORIZED_PARTIES`, recreate API container |
| WebSocket drops | Caddy passes upgrades by default; ensure clients use `wss://` when on HTTPS |
| Out of memory | Free shape allows up to 4 OCPU / 24GB total — resize if needed |

---

## Optional: Redis

Skip for single VM (Socket.IO in-memory). Add Upstash `REDIS_URL` to `.env` when scaling.

---

## Related

- Supabase + seed: [`DEPLOYMENT.md`](./DEPLOYMENT.md) §1
- Live URLs / env map: [`STAGING_STACK.md`](./STAGING_STACK.md)
