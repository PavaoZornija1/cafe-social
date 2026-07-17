# App UI Sound Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dedicated UI tap, success, and error effects to high-value navigation and staff/reward interactions.

**Architecture:** Extend the existing typed `triggerFeedback` event catalog and WAV asset registry. Reuse the existing preference, playback, haptic, and preload infrastructure; UI events never duck BGM.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, `expo-av`, `expo-haptics`, Node test runner.

## Global Constraints

- Bottom tabs sound only when switching to a non-focused tab and navigation is not prevented.
- All new events respect existing sound/haptics preferences.
- UI events must not duck background music.
- Keep imports at module tops and TypeScript switches exhaustive.
- Do not add dependencies.

---

### Task 1: Typed UI feedback events and assets

**Files:**
- Create: `app/assets/sounds/ui_tap.wav`
- Create: `app/assets/sounds/ui_success.wav`
- Create: `app/assets/sounds/ui_error.wav`
- Modify: `app/src/lib/feedback/feedbackSounds.ts`
- Modify: `app/src/lib/feedback/gameFeedback.ts`

- [ ] Generate three short mono PCM WAV files with distinct tap/upward/downward envelopes.
- [ ] Register `uiTap`, `uiSuccess`, and `uiError` sound IDs and feedback events.
- [ ] Map haptics to light, success, and error respectively.
- [ ] Confirm none are present in `BGM_DUCK_EVENTS`.

### Task 2: Bottom-tab feedback policy

**Files:**
- Create: `app/src/lib/__tests__/uiFeedbackPolicy.test.ts`
- Create: `app/src/lib/uiFeedbackPolicy.ts`
- Modify: `app/package.json`
- Modify: `app/src/components/navigation/AppTabBar.tsx`

- [ ] Write failing tests for `shouldTriggerTabSwitchFeedback(focused, defaultPrevented)`.
- [ ] Run `npm test` and confirm failure because the helper is missing.
- [ ] Implement the helper and use it before successful tab navigation.
- [ ] Extend the explicit test script to run both policy suites.
- [ ] Run `npm test` and confirm all tests pass.

### Task 3: Reward and staff feedback hooks

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`
- Modify: `app/src/screens/StaffQrScanScreen.tsx`
- Modify: `app/src/screens/StaffRedemptionsScreen.tsx`

- [ ] Trigger `uiSuccess` after a successful member-card offer claim.
- [ ] Trigger `uiSuccess` after member scan, pending-offer fulfillment, QR reward redemption, and acknowledgement.
- [ ] Trigger `uiError` for scan/redeem failures and unrecognized QR/manual codes.
- [ ] Ensure failed authentication/loading paths do not double-fire.

### Task 4: Settings copy and verification

**Files:**
- Modify: `app/src/i18n/locales/en.json`
- Modify: `app/src/i18n/locales/de.json`
- Modify: `app/src/i18n/locales/es.json`
- Modify: `app/src/i18n/locales/hr.json`

- [ ] Update sound-effects hints to include navigation and rewards.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run targeted lints/IDE diagnostics for changed TypeScript files.
