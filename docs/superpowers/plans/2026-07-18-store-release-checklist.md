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
3. **RevenueCat** — project **Cafe Social** (`projacddd540`) already exists with entitlement **`Cafe Social Pro`** (`entl7892bb6542`). Still to do: add the App Store + Play apps (today the only app is the **Test Store**), re-create monthly/yearly/lifetime against real store product IDs, and add consumables matching `VENUE_PLAY_BUDGET_IAP_PRODUCTS`.
4. **Stripe** (already for partners) — test mode webhook → Nest `/api/stripe/...` (partner only; not player IAP).
5. **EAS** — secrets below for `production` / `preview`.

## EAS / env secrets (app)

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` (prod admin URLs)
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=Cafe Social Pro`
- `EXPO_PUBLIC_VENUE_PLAY_BUDGET_IAP_PRODUCTS` (same as API)
- `EXPO_PUBLIC_EAS_PROJECT_ID`

## Backend secrets

- `REVENUECAT_WEBHOOK_AUTHORIZATION` + dashboard webhook URL → Nest RevenueCat webhook
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ENTITLEMENT_ID=Cafe Social Pro`
- `VENUE_PLAY_BUDGET_IAP_PRODUCTS`
- Stripe test keys for partner portal

## In-repo Phase A (done)

- [x] APP_ENV-aware bundle IDs
- [x] Subscription confirm with price + period + legal copy before purchase
- [x] Play-time **Claim purchased play time** recovery
- [x] Env placeholders in `app/.env.example` + `backend/.env.example`

## Trials, grace periods, pricing

**Where these actually live:** trial/intro offers and billing grace periods for real products are configured in **App Store Connect** and **Google Play Console**, not RevenueCat — RC mirrors them. The **Test Store** is the exception: RC owns the product definition, so its offer is set directly via the product-store-state plan API.

- [x] **7-day free trial on Test Store** — `P1W`, eligibility **`never_subscribed`**, applied to `monthly` (`proda9a9451d2e`) and `yearly` (`prod0c69d74ee4`) on 2026-09-19. Eligibility is **immutable** once set; RC rejects updating or removing it.
- [ ] **Re-declare the 7-day trial in App Store Connect** (introductory offer, per subscription) and **Google Play** (base plan → free-trial offer phase). Test Store config does not carry over.
- [ ] **Billing grace period** — not settable on the Test Store at all. Apple: account-level in ASC (off by default; 16 days). Google: per base plan, `grace_period_duration`, up to 30 days. Enable on both — it recovers failed-payment subscribers who would otherwise churn silently.
- [ ] **USD pricing looks wrong.** Test Store prices are EUR 4.99 / USD 9.99 (monthly) and EUR 39.99 / USD 79.99 (yearly) — USD is exactly **2×** EUR on both, ~85% above the FX-equivalent. Confirmed unintentional. Test Store currency prices are **create-only** (RC rejects updating an existing currency), so fix this when creating the real App Store / Play products rather than trying to edit the Test Store ones. Each currency is internally consistent (yearly = 33% off monthly), so only the cross-currency ratio is wrong.

## Still later (Phase B/C)

- [ ] Apple / Google / RevenueCat dashboards live
- [ ] Sign in with Apple (required if Google remains on iOS)
- [ ] Store screenshots, icons, privacy nutrition / Data safety
- [ ] TestFlight + Play Internal purchase matrix
- [ ] Production keys only on production profile
