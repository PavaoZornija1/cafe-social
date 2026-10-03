---
name: ship-mobile-app
description: Use when taking a mobile app from empty repo to live on the App Store and Google Play — domain and DNS setup, transactional email, Clerk auth in production, legal pages, RevenueCat and StoreKit payments, ads and ATT, App Store Connect and Play Console configuration, review submission, and recovering from rejections. Trigger on "ship this app", "submit to the App Store", "App Store rejected us", "set up in-app purchases", "Guideline 2.1 / 3.1.2 / 5.1.1", "RevenueCat error 23", "Paid Apps Agreement", "Data Safety form", "app store screenshots", or when starting a new mobile product and deciding what to set up first. Covers four monetization models (free, subscription, one-time, ads) because the model dictates which store requirements apply.
---

# Shipping a mobile app to both stores

Written from one complete App Store launch (Cafe Social, Sep–Oct 2026). Every
non-obvious claim carries a confidence tag:

- **`[verified]`** — done, and the result observed
- **`[documented]`** — from Apple/Google docs, not exercised here
- **`[inferred]`** — reasoning, flagged as such

Treat `[documented]` on the Play side with real caution: that launch was never
completed. Do not report a `[documented]` step to the user as if it were proven.

## The one thing to get right

**Almost nothing that hurts is code. What hurts is external latency and hidden
ordering.** On the launch this came from, the expensive items were:

| Item | Real cost | Why |
|---|---|---|
| Paid Applications Agreement | **~5 days** `[verified]` | Blocks *every* StoreKit product fetch. Needs a bank account, and propagation lags days behind the UI saying "Active" |
| Clerk production domain | hours, plus a live outage `[verified]` | Unverified domain → no cert → every production sign-in 403s |
| Apple review rounds | 3 rounds `[verified]` | Each missing artifact is a full round trip |
| Play account verification | unresolved `[verified]` | Needs a physical Android device |

Not one of those required a finished app. **Start the clock items on day one.**
Read `references/lead-times.md` first, before planning anything else.

## Phase order

Work top to bottom. Each phase unblocks the next; the clock items run in
parallel underneath all of them.

1. **Day one** — `references/lead-times.md`. Start every long-clock item now.
2. **Identity** — `references/domain-email.md`, then `references/auth.md`.
3. **Public surface** — `references/legal-pages.md`. Privacy, terms and account
   deletion must be live and reachable *without auth* before either store review.
4. **App conventions** — `references/stack-conventions.md`. Environment layout,
   bundle ids, build profiles.
5. **Monetization** — pick exactly one overlay and read it in full:
   - `references/money-free.md` — no IAP, no ads. Most blockers vanish.
   - `references/money-subscription.md` — auto-renewable.
   - `references/money-onetime.md` — non-consumable or consumable.
   - `references/money-ads.md` — AdMob, ATT, privacy fallout.
   Hybrid (ads on free tier, subscription removes them) = read both and union
   the requirements; nothing conflicts, but the privacy declarations stack.
6. **Store setup** — `references/app-store-connect.md`, `references/google-play.md`.
7. **Pre-submission** — `references/gauntlet.md`, and run `scripts/preflight.py`.
   Everything there is machine-checkable and every item on it has caused a real
   rejection.
8. **Submit, then handle rejections** — `references/rejections.md` maps symptom
   to cause to exact fix.

## Scripts

- `scripts/asc.py` — App Store Connect API client (ES256 JWT). Import it, or
  run `python3 asc.py /v1/apps` for a quick GET. `[verified]`
- `scripts/preflight.py` — runs the gauntlet against a live app record and
  prints pass/fail per check. Run it before every submission. `[verified]`

Both need `pyjwt` and `cryptography`, plus an App Store Connect API key
(`.p8`), its key id, and the issuer id.

## Rules that save whole days

1. **Never trust a store UI status without re-reading the API.** "Active",
   "Approved" and "Ready" have all been wrong or stale here. `[verified]`
2. **Read rejection text literally.** Apple's 2.1 boilerplate contained the line
   "In-App Purchase products should be configured and submitted alongside the
   app". It was dismissed as generic. It was the actual defect, and it cost an
   extra cycle. `[verified]`
3. **Check the deployment's error link, not just its status.** A `CANCELED`
   Vercel deploy looked like a paused project; the real cause was an
   `ignoreCommand` inspecting only the tip commit. `[verified]`
4. **Cancelling a review submission closes its Resolution Center thread.** You
   lose the ability to reply to that rejection, permanently. Reply *first*, then
   cancel if you must. `[verified]`
5. **The Resolution Center has no public API.** Replying is browser-only. Budget
   for it. `[verified]`
6. **A store product's state is not the same as its availability.** Verify
   against the device, not the dashboard.
