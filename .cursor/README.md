# Cursor agent setup (Cafe Social)

## Supabase MCP

Configured in [`mcp.json`](./mcp.json):

- Server: `https://mcp.supabase.com/mcp?project_ref=hhauytryloschyjqjbmj`
- **First use:** Cursor will prompt for Supabase OAuth — sign in and approve access, then reload the window if tools do not appear.

Use MCP for: SQL queries, advisors, docs search, inspecting tables — **not** for replacing Prisma migrations (schema source of truth remains `backend/prisma/`).

## Supabase agent skills

Installed via `npx skills add supabase/agent-skills` (project scope):

| Skill | When the agent uses it |
|-------|-------------------------|
| `supabase` | Any Supabase dashboard, MCP, CLI, or Postgres-on-Supabase task |
| `supabase-postgres-best-practices` | Query tuning, indexes, pooling, schema review |

Files live under [`.agents/skills/`](../.agents/skills/). Lockfile: [`skills-lock.json`](../skills-lock.json).

Update skills: `npx skills update supabase supabase-postgres-best-practices`

## Stack reminder

Postgres is on Supabase; **Nest + Prisma + Clerk** own app auth and API. See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
