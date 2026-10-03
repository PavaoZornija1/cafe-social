# Skills index

Skills live here and are symlinked into `~/.claude/skills/`, matching the
convention used in the justtikit repos. Claude loads one on its own when a
prompt matches its description; this index is for picking one deliberately.

```bash
ln -s "$(pwd)/skills/<name>" ~/.claude/skills/<name>
```

| Skill | Reach for it when |
|---|---|
| `ship-mobile-app` | Taking a mobile app from empty repo to live on the App Store and Play — domain, DNS, email, auth, legal pages, payments, ads, store setup, submission, and recovering from rejections. Also the first stop for a rejection you do not recognise. |

## ship-mobile-app

Written from the Cafe Social launch (Sep–Oct 2026) and the three Apple review
rounds it took. Its organising idea is that **the expensive parts are external
latency and hidden ordering, not code** — so it is sequenced by lead time rather
than by topic.

```
SKILL.md                       phase order and the day-one clock
references/
  lead-times.md                everything with an external clock
  domain-email.md              DNS, subdomains, SPF/DKIM/DMARC, Apple relay
  auth.md                      Clerk in production, and the traps
  legal-pages.md               privacy / terms / deletion, publicly reachable
  stack-conventions.md         APP_ENV, EAS profiles, env handling
  app-store-connect.md         API, metadata, submissions, Resolution Center
  google-play.md               verification, Data Safety, IARC, assets
  money-free.md                \
  money-subscription.md         |  pick exactly one; the model dictates
  money-onetime.md              |  which store requirements apply
  money-ads.md                 /
  gauntlet.md                  pre-submission checks, all machine-checkable
  rejections.md                symptom → cause → exact fix
scripts/
  asc.py                       App Store Connect API client (ES256 JWT)
  preflight.py                 runs the gauntlet; exits non-zero on failure
```

### Confidence tags

Every non-obvious claim is tagged, because this repo only ever completed the
Apple track:

- `[verified]` — done here, result observed
- `[documented]` — from Apple/Google docs, not exercised
- `[inferred]` — reasoning, flagged as such

**Most of `google-play.md` is `[documented]` and all of `money-ads.md` is**, since
neither shipped. Upgrade the tags as those paths are exercised rather than
assuming they are proven.

### preflight.py

The highest-value piece. Every rejection taken on this project was
machine-checkable before submitting.

```bash
export ASC_KEY_PATH=~/keys/AuthKey_XXXXXXXX.p8
export ASC_KEY_ID=XXXXXXXX
export ASC_ISSUER_ID=<issuer uuid>

python3 skills/ship-mobile-app/scripts/preflight.py <appId> --subs
```

Verified against this app's live submission: 18 checks, 0 failures.
