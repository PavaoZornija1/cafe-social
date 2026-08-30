# Cursor agent setup (Cafe Social)

## MCP servers

Configured in [`mcp.json`](./mcp.json):

| Server | URL | Auth |
|--------|-----|------|
| **Supabase** | project-scoped MCP | OAuth on first use |
| **Vercel** | `https://mcp.vercel.com` | OAuth |
| **Cloudflare** | several Cloudflare MCP endpoints | OAuth |
| **Stripe** | `https://mcp.stripe.com` | OAuth (or restricted API key) |
| **RevenueCat** | `https://mcp.revenuecat.ai/mcp` | OAuth (or API v2 secret key) |

**First use of Stripe / RevenueCat:** Cursor will prompt for OAuth — approve access, then reload the window if tools do not appear. Prefer OAuth over putting secret keys in `mcp.json`.

Use Stripe MCP for products, prices, customers, and docs search while wiring partner billing. Use RevenueCat MCP for apps, products, entitlements, and offerings for mobile subs.

## RevenueCat AI Toolkit (skills)

Skills from [`RevenueCat/ai-toolkit`](https://github.com/RevenueCat/ai-toolkit) are installed under [`.agents/skills/`](../.agents/skills/) (see `skills-lock.json`).

Also install the Cursor Marketplace plugin so MCP + skills stay in sync: run `/add-plugin revenuecat` in chat, or install from [cursor.com/marketplace/revenuecat](https://cursor.com/marketplace/revenuecat/revenuecat).

Update skills: `npx skills update` (project scope) or re-run `npx skills add RevenueCat/ai-toolkit --skill '*' --agent cursor -y`.

## Supabase MCP

- Server: `https://mcp.supabase.com/mcp?project_ref=hhauytryloschyjqjbmj`
- Use MCP for: SQL queries, advisors, docs search, inspecting tables — **not** for replacing Prisma migrations (schema source of truth remains `backend/prisma/`).

## Supabase agent skills

Installed via `npx skills add supabase/agent-skills` (project scope):

| Skill | When the agent uses it |
|-------|-------------------------|
| `supabase` | Any Supabase dashboard, MCP, CLI, or Postgres-on-Supabase task |
| `supabase-postgres-best-practices` | Query tuning, indexes, pooling, schema review |

Files live under [`.agents/skills/`](../.agents/skills/). Lockfile: [`skills-lock.json`](../skills-lock.json).

Update skills: `npx skills update supabase supabase-postgres-best-practices`

## Stack reminder

Postgres is on Supabase; **Nest + Prisma + Clerk** own app auth and API. Partner SaaS billing is Stripe; guest mobile subs are RevenueCat. See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
