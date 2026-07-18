# Store / payments Phase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or implement directly in-session). Steps use checkbox (`- [ ]`) syntax.

**Goal:** In-repo prep for App Store / Play without requiring live store dashboards yet — IDs, review-safe paywall, consumable claim recovery, env placeholders + checklist.

**Architecture:** Players pay via RevenueCat (Apple/Google). Partners pay via Stripe (portal). This plan only touches consumer IAP prep + release config. Production IDs: `com.cafesocial.app` (prod), `com.cafesocial.app.dev` (non-prod).

**Tech stack:** Expo `app.config.js` + EAS `APP_ENV`, `react-native-purchases`, Nest `venue-play-budget` claim API.

---

### Task 1: APP_ENV-aware bundle IDs

**Files:** `app/app.config.js`, `app/eas.json` (verify), README store note

- [x] Branch `bundleIdentifier` / `package` on `APP_ENV === 'production'` → `com.cafesocial.app`, else `com.cafesocial.app.dev`
- [x] Note: local `expo run:ios` may still use native pbxproj until next prebuild; document that

### Task 2: Review-safe subscription paywall

**Files:** `app/src/screens/SettingsScreen.tsx`, i18n locales

- [x] Before `purchasePackage`, show confirm with price string, period, privacy + terms links
- [x] Prefer listing packages when multiple exist (monthly/annual)

### Task 3: Play-time IAP claim recovery

**Files:** `app/src/lib/venuePlayBudgetIap.ts`, Settings / purchase UI

- [x] Claim-only path: sync RC → find non-sub txs for catalog products → POST claim
- [x] Settings button “Claim purchased play time”

### Task 4: Env placeholders + checklist

**Files:** `app/.env.example`, `backend/.env.example`, `docs/superpowers/plans/2026-07-18-store-release-checklist.md` (or README section)

- [x] Document RC + IAP product env vars
- [x] Short account-setup checklist (Apple, Google, RC, Stripe, EAS secrets)

---

**Out of scope (Phase B/C):** Apple Sign-In flip, store screenshots, live products, TestFlight.
