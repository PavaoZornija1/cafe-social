# Billing setup design — Stripe (partners) + RevenueCat (guests)

**Date:** 2026-08-22  
**Status:** Approved (conversation); pending file review  
**Scope:** Catalog, prices, webhooks, and env wiring for the existing Nest/admin/Expo billing code. No new payment product architecture.

---

## Context

Cafe Social already implements two payment rails in code:

| Rail | Payer | Surface | Nest hooks |
|------|--------|---------|------------|
| **Stripe** | Partner orgs | Admin / owner portal | `STRIPE_*`, `POST /api/webhooks/stripe` |
| **RevenueCat** | Guests | Expo app | `REVENUECAT_*`, `POST /api/webhooks/revenuecat` |

Unifying into one processor was rejected: guest digital IAP must use App Store / Play (via RevenueCat); partner B2B SaaS + metered PPV belongs on Stripe.

No euro amounts lived in the repo — only env placeholders for `price_…` IDs and entitlement names.

---

## Decisions

1. **Keep dual stack** (Stripe partners + RevenueCat guests).
2. **Currency:** EUR only for pilot; BAM / multi-currency later on Stripe if needed. Mobile regional pricing follows Apple/Google when store products exist.
3. **Pilot prices:**
   - Partner SaaS: **€49 / month**
   - Pay-per-visit (metered): **€0.50 / visit**
   - Cafe Social Pro: **€4.99 / month**, **€39.99 / year**
   - Venue play packs (30m/60m): **out of scope** for this pass
4. **Stores:** App Store Connect / Play not ready (Apple Developer enrollment pending). Use RevenueCat **Test Store** for Pro products; swap to App Store / Play apps later.
5. **Approach:** Create catalog + wire env/webhooks now (not “wait for Apple”, not “Stripe-only”).

---

## Stripe (test mode)

**Account:** existing test-mode MCP account (`acct_1Sj6BX…`).

### Catalog

| Product | Price | Env target |
|---------|-------|------------|
| Partner SaaS (recurring) | €49 / month (EUR) | `STRIPE_PARTNER_PRICE_ID` |
| Pay per visit (metered) | €0.50 per unit (EUR) | `STRIPE_PPV_METERED_PRICE_ID` |

Nickname / lookup keys should be human-readable (e.g. partner monthly, ppv metered) so admin UI plan labels resolve cleanly.

### Webhook

- URL: `https://api.cafe-social.com/api/webhooks/stripe`
- Events (as required by existing Nest handlers):  
  `checkout.session.completed`,  
  `customer.subscription.created`,  
  `customer.subscription.updated`,  
  `customer.subscription.deleted`
- Store signing secret as `STRIPE_WEBHOOK_SECRET` on the VPS.

### Env (VPS `deploy/oracle/.env`)

- `STRIPE_SECRET_KEY` (test) — may already be present  
- `STRIPE_PUBLISHABLE_KEY` (test)  
- `STRIPE_WEBHOOK_SECRET`  
- `STRIPE_PARTNER_PRICE_ID`  
- `STRIPE_PPV_METERED_PRICE_ID`  
- `STRIPE_PPV_USAGE_REPORTING_ENABLED=true` (default)

Optional admin: `NEXT_PUBLIC_STRIPE_PARTNER_PRICE_ID` if the portal needs a client-side default.

### Out of scope (Stripe)

- Live mode products  
- BAM / Adaptive Pricing  
- Changing Nest Checkout / Elements flows  

---

## RevenueCat

### Project / apps

- Use existing RC project if one exists for Cafe Social; otherwise create one.
- Create / use **Test Store** app (no ASC/Play credentials yet).
- Bundle IDs for later ASC wiring: `com.cafesocial.app` (prod), `com.cafesocial.app.dev` (staging).

### Catalog

| RC product | Type | Pilot amount (Test Store) | Package |
|------------|------|---------------------------|---------|
| Pro monthly | subscription | €4.99 / month | `$rc_monthly` |
| Pro annual | subscription | €39.99 / year | `$rc_annual` |

- **Entitlement:** `Cafe Social Pro` (must match code defaults in Expo + Nest; do **not** use docs’ outdated `premium`).
- **Offering:** `default` (current), packages attached as above.

### Webhook

- URL: `https://api.cafe-social.com/api/webhooks/revenuecat`
- Authorization header must match Nest `REVENUECAT_WEBHOOK_AUTHORIZATION` exactly.
- Prefer REST sync via `REVENUECAT_SECRET_API_KEY` after webhook events (existing Nest behavior).

### Env

**Expo / EAS:** Test Store public API key(s) → `EXPO_PUBLIC_REVENUECAT_*` (and/or platform-specific keys as already documented in `app/.env.example`).  
`EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=Cafe Social Pro`

**VPS:** `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_ENTITLEMENT_ID=Cafe Social Pro`

### Out of scope (RC)

- Venue play IAP products  
- App Store / Play store credentials and real IAP SKUs (post–Apple Developer)  
- Official Apple MCP (none exists; community ASC MCP only after enrollment + API key)

---

## Success criteria

- [ ] Stripe test products/prices exist; price IDs on VPS; partner Checkout / PPV session can be created without “price not configured”
- [ ] Stripe webhook endpoint active; health path unchanged; signature verifies
- [ ] RC Test Store products + entitlement + current offering with monthly/annual packages
- [ ] Nest + Expo entitlement ID aligned on `Cafe Social Pro`
- [ ] RC webhook authorized against Nest
- [ ] Docs (`STAGING_STACK.md`) no longer list Stripe/RC as “optional later” once wired

---

## Follow-ups (explicitly later)

1. Enroll Apple Developer → App Store Connect IAP → RC App Store app + store products at same price points.  
2. Optional community App Store Connect MCP with ASC API key.  
3. BAM (or Adaptive Pricing) partner Stripe prices.  
4. Venue play consumables in RC + stores.  
5. Live Stripe mode + production RC public keys in EAS production profile.

---

## Implementation note

Execute via Stripe MCP (test `livemode: false`) and RevenueCat MCP, then update VPS/Vercel/EAS env and staging docs. Prefer configuring dashboards/env over changing Nest/Expo billing logic unless a mismatch is found.
