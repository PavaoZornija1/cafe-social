# Billing Stripe + RevenueCat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create EUR pilot Stripe (partner SaaS + PPV) and RevenueCat Test Store (Cafe Social Pro) catalogs, wire webhooks/env to the existing Nest API.

**Architecture:** Stripe MCP (test mode) for B2B prices; RevenueCat MCP for Test Store products/entitlement/offering; secrets on Hetzner `deploy/oracle/.env` (+ optional Vercel/EAS). No Nest/Expo billing logic changes unless IDs mismatch.

**Tech Stack:** Stripe MCP, RevenueCat MCP, Hetzner VPS env, existing Nest webhook routes.

**Spec:** [`docs/superpowers/specs/2026-08-22-billing-stripe-revenuecat-design.md`](../specs/2026-08-22-billing-stripe-revenuecat-design.md)

## Global Constraints

- Stripe: test mode only (`livemode: false`), account `acct_1Sj6BXB5x0B8YBlY`
- Currency: EUR
- Prices: partner €49/mo, PPV €0.50 metered, Pro €4.99/mo + €39.99/yr
- Entitlement lookup: exactly `Cafe Social Pro`
- Webhooks: `https://api.cafe-social.com/api/webhooks/stripe` and `.../revenuecat`
- Venue packs: skip; App Store / Play: later

---

## Task 1: Stripe catalog + webhook

**Deliverable:** Partner + PPV price IDs and webhook endpoint in Stripe test mode.

- [x] List existing products/prices; reuse if already matching pilot amounts
- [x] Create Partner SaaS product + monthly EUR 4900 cents price
- [x] Create Pay-per-visit product + metered EUR 50 cents price
- [x] Create webhook endpoint for required subscription/checkout events
- [x] Record `price_…` IDs and `whsec_…` for Task 3

## Task 2: RevenueCat Test Store catalog

**Deliverable:** Current offering with monthly/annual packages unlocking `Cafe Social Pro`.

- [x] `list-projects` / create project if needed
- [x] Ensure Test Store app exists (`create-app` type `test_store` if missing)
- [x] Create Pro monthly + annual products; set Test Store prices via `create-product-prices`
- [x] Create entitlement `Cafe Social Pro`; attach both products
- [x] Create offering `default` (current); packages `$rc_monthly` / `$rc_annual`; attach products
- [x] List public API keys for Expo env

## Task 3: Wire env + docs

**Deliverable:** VPS (and docs) know the new IDs; staging stack reflects billing as live.

- [x] Append Stripe + RC vars to server `deploy/oracle/.env` (SSH) without committing secrets
- [x] Redeploy/restart API compose if needed so Nest picks up env
- [x] Update `docs/STAGING_STACK.md` (remove “optional later” for Stripe/RC; note Test Store)
- [x] Update `deploy/oracle/.env.example` with required var names (no secrets)
- [x] Smoke: `GET /api/health`; note manual portal Checkout + RC sandbox as follow-up QA

## Task 4: Hand off secrets to local reminders

**Deliverable:** Local gitignored secrets file lists new non-secret IDs + placeholders for keys the user must copy from dashboards.

- [x] Update `docs/STAGING_STACK.secrets.local.md` with price IDs, webhook URLs, RC entitlement (no paste of new live secrets into chat)

### Remaining manual

- [ ] Add `REVENUECAT_SECRET_API_KEY` on VPS (RC dashboard → API keys) for REST entitlement sync
- [ ] Set Expo/EAS `EXPO_PUBLIC_REVENUECAT_API_KEY=test_ztQDveiUdzmqHOmFQijwgQpPFsT` (and entitlement id)
- [ ] Optional: `NEXT_PUBLIC_STRIPE_PARTNER_PRICE_ID` on Vercel
- [ ] QA partner Checkout + Test Store purchase flow
