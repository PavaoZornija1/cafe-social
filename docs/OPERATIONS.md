# Production security and recovery

The mobile app and portal use Nest with Clerk. They do not use Supabase's Data
API. All `public` application tables have RLS enabled with no client policies;
the backend's `postgres` connection owns the tables and can still access them.
Anonymous and authenticated API roles have no application table privileges.
The migration also removes automatic grants for tables created by the migration
role. New tables must enable RLS too; the daily restore check catches omissions.

Legacy `/api/players` CRUD routes have been removed. Player HTTP routes require
a JWT at controller level and operate on the signed-in identity under `/me`.

## Database TLS

The image includes `backend/certs/supabase-ca.crt`, downloaded from the link in
Supabase's Database Settings. It expires April 26, 2031. Its SHA-256 fingerprint
is `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.

- Runtime `DATABASE_URL`: `sslmode=verify-full&sslrootcert=/app/certs/supabase-ca.crt`.
- Prisma CLI `DIRECT_DATABASE_URL`: `sslmode=require&sslaccept=strict&sslcert=/app/certs/supabase-ca.crt`.

The two drivers use different URL parameters. Production startup rejects a
runtime URL without `sslmode=verify-full`. Do not bypass certificate validation.
Update the CA from the dashboard before certificate rotation, then verify both
a database query and `prisma migrate status` before deploying it.

## Encrypted off-site backups

The **Database backup** GitHub Actions workflow runs daily at 02:23 UTC and can
also be run manually. It dumps the complete `public` application schema over
verified TLS, encrypts the archive with GnuPG AES-256, and keeps the encrypted
artifact for 30 days. It then decrypts and restores the archive into an isolated
temporary PostgreSQL 17 container, checks essential tables and migration history,
and requires RLS on every restored application table. A failed restore fails the
workflow; the encrypted artifact has already been uploaded for recovery.

The repository is public. Only encrypted archives are uploaded. The database URL
and encryption passphrase are GitHub Actions secrets named `BACKUP_DATABASE_URL`
and `BACKUP_PASSPHRASE`. Neither value is committed or printed. The recovery
passphrase and an encrypted pre-hardening checkpoint are also stored locally in
the gitignored `deploy/oracle/.recovery/` directory. Keep a secure copy of that
passphrase: GitHub secrets cannot be read back, and losing it loses the backups.

GitHub can disable scheduled workflows after 60 days without repository activity.
Check workflow failures and the age of the newest artifact. Before leaving this
repository unattended, move the schedule to a dedicated backup service or enable
managed database backups. This setup does not purchase a Supabase upgrade.

Backups contain application data, enum definitions and migration history. They
exclude Supabase's internal schemas, Clerk identities, infrastructure secrets,
and binary Storage objects (there are currently no Storage buckets). Restore
infrastructure and provider settings separately. Dumps omit original ownership
and grants; apply the server-only access migration on a replacement Supabase DB.

To verify an archive manually, download its artifact with `gh run download`, start
an **empty, isolated PostgreSQL 17** container named `backup-restore`, and run:

```sh
gpg --batch --decrypt --pinentry-mode loopback \
  --passphrase-file deploy/oracle/.recovery/backup-passphrase cafe-social.dump.gpg \
  | docker exec -i backup-restore pg_restore --clean --if-exists \
      --exit-on-error --no-owner --no-privileges -U postgres -d postgres
```

Use `set -o pipefail` so a failed decryption also fails the command. Never point
this restore command at the running production database.

## Partner onboarding

The default application URL is `https://cafe-social.com/partners#apply`.
`NEXT_PUBLIC_LANDING_PARTNERS_APPLY_URL` can override it at portal build time.
Local development can set this explicitly to `http://localhost:3001/partners#apply`.
