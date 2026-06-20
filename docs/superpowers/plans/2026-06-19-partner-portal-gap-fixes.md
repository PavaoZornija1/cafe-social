# Partner Portal Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close partner-portal gaps from the June 2026 audit — wire missing APIs, add multi-location self-serve, clarify billing UX, and polish analytics/export flows.

**Architecture:** Minimal backend routes exposing existing services (`OwnerCampaignService` bindings, `StripePartnerBillingService.createPartnerEmbeddedSubscriptionClientSecret`). Frontend: new `PartnerAddVenueForm`, subscriptions billing-model cards, org rollup header fixes, export buttons decoupled from mutation read-only.

**Tech Stack:** NestJS owner API, Next.js admin portal, Stripe Elements + Checkout, react-i18n overlays.

---

## Task 1: Campaign bindings API routes

**Files:**
- Modify: `backend/src/owner/owner.controller.ts`

- [ ] Add GET/POST/DELETE for `/owner/venues/:venueId/campaigns/:campaignId/bindings` using existing `OwnerCampaignService` + guards matching other campaign routes.

## Task 2: Embedded subscription setup endpoint

**Files:**
- Modify: `backend/src/owner/owner.controller.ts`

- [ ] Add GET `/owner/organizations/:organizationId/stripe/elements-subscription-setup` → `createPartnerEmbeddedSubscriptionClientSecret` with `OrganizationStaffGuard`.

## Task 3: Partner “Add location” UI

**Files:**
- Create: `admin/src/components/PartnerAddVenueForm.tsx`
- Modify: `admin/src/lib/queries/index.ts` — `useOwnerCreateVenueUnderOrgMutation`
- Modify: `admin/src/app/(portal)/owner/venues/page.tsx`
- Modify: `admin/src/i18n/overlays/en.json` (+ de/hr/es keys)

- [ ] Form: name, optional address/city/country, geofence map → POST `/owner/organizations/:id/venues`
- [ ] Show for org OWNER when `locationKind === MULTI_LOCATION`; trial cap message when not paying and already 1 venue

## Task 4: Billing UX — one clear path per model

**Files:**
- Modify: `admin/src/app/(portal)/owner/subscriptions/page.tsx`
- Modify: `admin/src/i18n/overlays/en.json` (+ de/hr/es)

- [ ] Replace three equal CTAs with two cards: Monthly subscription vs Pay per visit
- [ ] PPV card: partner copy + link to `/owner/analytics?org=`
- [ ] Hide subscribe block when billing already active; keep portal/refresh

## Task 5: Org rollup polish + analytics link

**Files:**
- Modify: `admin/src/app/(portal)/owner/organizations/[organizationId]/page.tsx`

- [ ] Title = org name from venues list; UUID in `<details>`
- [ ] Link to analytics hub `?org=`
- [ ] Allow CSV exports when read-only (view-only partners)

## Task 6: Venue dashboard exports when read-only

**Files:**
- Modify: `admin/src/app/(portal)/owner/venues/[venueId]/page.tsx`

- [ ] Remove `readOnlyDisabled` from analytics CSV export buttons only

## Task 7: Verification

- [x] Backend tests (campaign bindings controller smoke if needed; existing service tests)
- [x] `npm run build` in backend + admin typecheck

---

## Follow-up (2026-06-19)

- [x] Split venue dashboard into route-based sections under `owner/venues/[venueId]/`
- [x] de/hr/es translations for `partnerAddVenue`, billing cards, org rollup header
