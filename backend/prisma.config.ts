import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/** Prisma CLI (migrate, seed, studio) — session/direct URL when runtime uses transaction pooler. */
const migrationDatabaseUrl =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!migrationDatabaseUrl) {
  throw new Error(
    'Set DIRECT_DATABASE_URL (Supabase direct / local Postgres) or DATABASE_URL for Prisma CLI',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: migrationDatabaseUrl,
  },
});

