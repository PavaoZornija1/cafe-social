# Store / Play release checklist (from zero)

Companion to [Phase A plan](./2026-07-18-store-payments-phase-a.md). Do **accounts first**, then wire secrets, then sandbox purchases.

## Bundle IDs (already in `app/app.config.js`)

| `APP_ENV` | iOS / Android ID |
|-----------|------------------|
| `production` | `com.cafesocial.app` |
| `preview` / `staging` | `com.cafesocial.app.dev` |
| local / unset | `com.pavaozornija.cafesocial.devclient` (existing device profile) |

Register `com.cafesocial.app` / `.dev` in Apple Developer when the paid team is ready; until then local device builds keep the personal-team id.

## Account setup order

1. **Apple Developer** — create App ID `com.cafesocial.app` (+ `.dev` if using TestFlight side-by-side).
2. **Google Play Console** — create app with package `com.cafesocial.app`.
3. **RevenueCat** — new project; link App Store + Play; entitlement `premium`; offerings with monthly/annual; consumables matching `VENUE_PLAY_BUDGET_IAP_PRODUCTS`.
4. **Stripe** (already for partners) — test mode webhook → Nest `/api/stripe/...` (partner only; not player IAP).
5. **EAS** — secrets below for `production` / `preview`.

## EAS / env secrets (app)

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` (prod admin URLs)
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=premium`
- `EXPO_PUBLIC_VENUE_PLAY_BUDGET_IAP_PRODUCTS` (same as API)
- `EXPO_PUBLIC_EAS_PROJECT_ID`

## Backend secrets

- `REVENUECAT_WEBHOOK_AUTHORIZATION` + dashboard webhook URL → Nest RevenueCat webhook
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID=premium`
- `VENUE_PLAY_BUDGET_IAP_PRODUCTS`
- Stripe test keys for partner portal

## In-repo Phase A (done)

- [x] APP_ENV-aware bundle IDs
- [x] Subscription confirm with price + period + legal copy before purchase
- [x] Play-time **Claim purchased play time** recovery
- [x] Env placeholders in `app/.env.example` + `backend/.env.example`

## Still later (Phase B/C)

- [ ] Apple / Google / RevenueCat dashboards live
- [ ] Sign in with Apple (required if Google remains on iOS)
- [ ] Store screenshots, icons, privacy nutrition / Data safety
- [ ] TestFlight + Play Internal purchase matrix
- [ ] Production keys only on production profile
