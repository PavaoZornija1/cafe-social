# Partner Portal UX Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close partner-portal UX gaps identified in the June 2026 audit — clearer flows, localized labels, section navigation, and billing/campaign usability.

**Architecture:** Incremental frontend changes in `admin/` — shared label helpers, extracted campaign-bindings component with entity picker, sticky section nav on the venue dashboard, i18n keys in existing overlay files. Hosted Stripe checkout wired as fallback alongside embedded Elements. Plan pricing deferred until backend exposes amount/currency.

**Tech Stack:** Next.js 15, react-i18next, TanStack Query, Stripe Elements + Checkout Session API.

---

## Phase 1 — Quick wins (copy, links, labels)

### Task 1: Playbook copy fix

**Files:**
- Modify: `admin/src/i18n/overlays/partnerVenueDetail.{en,de,hr,es}.json`
- Modify: `admin/src/app/(portal)/owner/venues/[venueId]/page.tsx` (playbook render)

- [ ] Replace geofence step (“CMS super admin”) with onboarding + Locations & content guidance
- [ ] Remove repo file path; use partner-facing brief link text only
- [ ] Step 3 points to Locations & content CMS for perks/challenges

### Task 2: Empty venues + accept-invite CTA

**Files:**
- Modify: `admin/src/app/(portal)/owner/venues/page.tsx`
- Modify: `admin/src/app/(portal)/owner/accept-invite/page.tsx`
- Modify: `admin/src/lib/queries/index.ts` (accept invite response type includes `venueId`)
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json`

- [ ] Empty partner state links to `/owner/accept-invite`
- [ ] Post-accept success shows CTA → `venuePortalHomePath(role, venueId)` when `venueId` returned

### Task 3: Billing status labels

**Files:**
- Create: `admin/src/lib/partnerBillingLabels.ts`
- Modify: `admin/src/app/(portal)/owner/subscriptions/page.tsx`
- Modify: `admin/src/app/(portal)/owner/venues/[venueId]/page.tsx` (header billing line)
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json` (`admin.partnerBillingStatus.*`)

- [ ] Human-readable badges for `NONE`, `TRIALING`, `ACTIVE`, `ACTIVE_CANCELING`, `PAST_DUE`, `CANCELED`
- [ ] Hide raw org UUID from main billing card (optional `<details>` for support)

### Task 4: Dashboard redirect i18n

**Files:**
- Modify: `admin/src/app/dashboard/page.tsx`
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json`

- [ ] Replace hardcoded `Redirecting…` with `admin.common.redirecting`

---

## Phase 2 — Medium UX

### Task 5: Venue dashboard section nav

**Files:**
- Create: `admin/src/components/VenueDashboardSectionNav.tsx`
- Modify: `admin/src/app/(portal)/owner/venues/[venueId]/page.tsx`
- Modify: `admin/src/i18n/overlays/partnerVenueDetail.{en,de,hr,es}.json` (`sectionNav.*`)

- [ ] Sticky horizontal nav: Playbook · Analytics · Moderation · Team · Campaigns · Receipts · Redemptions
- [ ] Items gated by `canAnalytics` / `isOwner`; sections get matching `id="venue-section-*"`

### Task 6: Campaign binding entity picker

**Files:**
- Create: `admin/src/components/CampaignBindingsEditor.tsx`
- Modify: `admin/src/app/(portal)/owner/venues/[venueId]/page.tsx` (remove inline editor)
- Modify: `admin/src/i18n/overlays/partnerVenueDetail.{en,de,hr,es}.json` (`bindings.types.*`, `bindings.selectEntity`)

- [ ] Dropdown of venue perks / offers / challenges from existing admin list queries
- [ ] Translate binding type labels and appeal status badges

### Task 7: Campaign copy templates i18n

**Files:**
- Modify: `admin/src/lib/campaignCopyTemplates.ts`
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json` (`admin.partnerCampaignTemplates.*`)

- [ ] `getCampaignCopyTemplates(t)` reads labels/title/body from i18n; segment days stay in code

### Task 8: Terminology unification (“Locations”)

**Files:**
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json`

- [ ] Align shell, analytics back links, org rollup back links to “Locations”
- [ ] Staff bottom-nav label: “Locations” (not “Redemptions”) — list hub for multi-venue staff

### Task 9: Moderation appeal date inputs

**Files:**
- Modify: `admin/src/app/(portal)/owner/venues/[venueId]/page.tsx`

- [ ] Change appeals from/to filters from free-text to `type="date"`

---

## Phase 3 — Billing polish

### Task 10: Refresh billing status

**Files:**
- Modify: `admin/src/app/(portal)/owner/subscriptions/page.tsx`
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json`

- [ ] “Refresh status” button invalidates `owner.venuesList` + `portal.me`
- [ ] Same on post-payment success banner

### Task 11: Hosted Stripe checkout fallback

**Files:**
- Modify: `admin/src/app/(portal)/owner/subscriptions/page.tsx`
- Modify: `admin/src/app/(portal)/owner/subscriptions/pay/page.tsx`
- Modify: `admin/src/i18n/overlays/{en,de,hr,es}.json`

- [ ] Secondary CTA uses `useOwnerOrganizationCheckoutMutation` → redirect to Stripe hosted page
- [ ] Pay-page error copy matches available options (embedded + hosted)

---

## Deferred (needs backend or product decision)

- [ ] **Plan price on subscribe card** — requires price amount in elements-setup or org billing API
- [ ] **Nudge template seed strings** — guest content; use venue locale defaults later
- [ ] **Split venue dashboard into sub-routes** — larger refactor; section nav is interim fix
- [ ] **Dynamic `<title>` per admin locale** — low impact on internal portal

---

## Verification

```bash
cd admin && npm run typecheck && npm run lint
```

Manual smoke:
1. Switch language de/hr → billing badges and campaign templates localized
2. Venue dashboard → section nav scrolls to each block
3. Campaign binding → pick perk from dropdown, no UUID paste
4. Empty venues → accept-invite link; accept invite → “Open location” CTA
5. Subscriptions → refresh + hosted checkout redirect (if Stripe configured)
