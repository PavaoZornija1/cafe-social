# Rejection playbook

Symptom → cause → fix. Tags mark what was actually encountered.

## Guideline 2.1 — Information Needed `[verified]`

**Looks like:** a long message asking for six things, plus a "Prevent Common
Issues" block at the end.

**It is not a defect rejection.** It is sent to accounts with limited review
history. Nothing in it necessarily identifies a bug.

**But read the boilerplate literally anyway.** The "Prevent Common Issues" block
contained *"In-App Purchase products should be configured and submitted
alongside the app"* — which was the actual defect, and was dismissed as generic.
That mistake cost a full cycle.

**Fix:** supply all six items (see `gauntlet.md`), reply in Resolution Center
**and** put the same content in App Review Information → Notes. Apple asks for
both explicitly.

**Trap:** if you cancel the submission to restructure it, the Resolution Center
thread closes permanently and you can no longer reply. Reply first.

## Guideline 3.1.2 — subscriptions without a Terms of Use link `[verified]`

**Looks like:** "This is an automated message. The review of this submission
cannot proceed... does not include a functional link to the Terms of Use (EULA)
in the app metadata."

**Cause:** auto-renewable subscriptions with no EULA link on the product page.
Automated; fires before human review.

**Fix:** check `GET /v1/apps/{id}/endUserLicenseAgreement`. If `data: null`, you
are on the standard Apple EULA and the link must be in the **App Description**:
`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`. Otherwise
register a custom EULA in App Store Connect.

A privacy policy URL does **not** satisfy this. Ours was correct and we were
rejected regardless.

Then use **Update Review** on the version page — it reopens the same submission
with all items intact.

## "RevenueCat error 23" / configuration error `[verified]`

Full diagnosis order is in `money-subscription.md`. The short version: **if the
Paid Applications Agreement went active recently, wait.** Products genuinely do
not fetch for days afterwards. This was misdiagnosed three times here — first
blamed on the simulator, then on the agreement alone, then on products being
unsubmitted. Only the propagation delay explained it.

## Sign-in "does nothing" in production `[verified]`

Check, in order: the auth hostname's certificate (is it your zone wildcard
rather than one naming the host?); whether the custom domain is **verified** in
the provider dashboard; whether the build carries a `pk_live_` key; whether
Device Trust is on. See `auth.md`.

## Legal pages 404 for the reviewer `[verified]`

Two independent causes, both seen:
1. Auth middleware protecting the routes — add them to the public matcher
2. The deploy never happened — an `ignoreCommand` inspecting only the tip commit
   silently skipped it. Read the deployment's **error link**, not just its
   `CANCELED` status

## Android force-closes on launch `[verified]`

A payment SDK initialised with a test-store key against real Play Billing, with
no Android app configured at the provider. Create the Play app and the
provider's Android app first, or blank the key in that build profile.

## Android headers under the status bar `[verified]`

`SafeAreaView` imported from `react-native` is iOS-only. Swap to
`react-native-safe-area-context` repo-wide, keep default `edges` so iOS is
unchanged.

## Account deletion appears to work but does not `[verified]`

A trailing authenticated request re-creates the row via an auto-provisioning
helper. Invisible in the UI. See `auth.md`.

---

# Working with rejections generally

1. **Quote the rejection back and address each clause.** Apple's messages are
   more specific than they look.
2. **Verify the state over the API before and after.** Dashboard text and email
   subjects have both been wrong here.
3. **Reply before cancelling anything.**
4. **Fix the class, not the instance.** The EULA miss was fixed in the Play
   listing draft at the same time, because Play has the same rule.
5. **Expect state to unwind.** A rejection returns the version to `REJECTED`,
   IAPs to `READY_TO_SUBMIT` and the submission to `UNRESOLVED_ISSUES`. Re-check
   all of them before resubmitting; do not assume the IAPs are still attached.
