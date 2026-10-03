# Overlay: auto-renewable subscriptions

The hardest of the four. Everything here is `[verified]` unless marked.

Prerequisite: **Paid Applications Agreement active**, plus the propagation wait.
See `lead-times.md`. Nothing below works until that is true.

## Setup order

1. Paid Apps Agreement: tax forms **and** bank account → wait for Active → then
   **keep waiting** (measured: ~5 further days before products fetched)
2. App Store Connect: create the **subscription group**, then each subscription
   inside it
3. Each subscription needs: reference name, product id, duration, **price in
   every territory**, a localized display name and description, and a
   **review screenshot plus review notes**
4. RevenueCat (or equivalent): create the app with the **exact bundle id**, add
   the App Store Connect API key *and* the in-app purchase key
5. Create products matching the store product ids, attach them to **packages**
   in an offering, attach the offering's products to an **entitlement**
6. Mark the offering **current**
7. Set the entitlement identifier in the app's env, matching exactly

## Error 23 / "configuration error": diagnose in this order

The most expensive bug of the launch. Check cheapest-first:

1. **Is the Paid Applications Agreement active — and how long ago?** If recently,
   **wait**. Products genuinely do not fetch for days afterwards. Days were lost
   here re-verifying settings that were already correct.
2. Bundle id in the payment provider == bundle id the build actually ships
3. The build's publishable key belongs to that provider app (`appl_` for iOS,
   `goog_` for Android — a `test_` key against real StoreKit fails)
4. **No generic shared key overriding the platform key** — see
   `stack-conventions.md`
5. Store credentials validate (API key, in-app purchase key)
6. An offering is marked **current** and its packages carry the store products
7. The **entitlement identifier** matches the app's env exactly — a mismatch
   lets a purchase succeed and unlock nothing, which is worse than failing
8. Products exist in the store with price and localizations complete

**A product in `READY_TO_SUBMIT` *is* fetchable once the agreement is live.**
It was wrongly concluded here that products had to be submitted for review
before StoreKit would serve them. They do not.

Ask the store what it actually thinks, rather than reading a dashboard:

```python
# RevenueCat exposes the store's own view, with a fetch timestamp
get-product-store-state → store_status.raw_store_status
```

## Submitting: the omission that costs a cycle

`[verified]` **In-app purchases must go into the review submission *alongside*
the app version.** Building a submission containing only the app version leaves
the subscriptions at `READY_TO_SUBMIT` and earns a rejection whose text says
exactly that — a line easy to dismiss as boilerplate. It is not boilerplate.

A complete first submission contains **four** items:
- the app version
- the subscription group
- each subscription (one item each)

The API will **not** attach subscriptions to a review submission. Every
relationship name is rejected; it is a UI-only operation. Add them in App Store
Connect, then verify over the API that the submission has all four items.

If a version is already attached to an open submission, you must cancel that
submission before re-adding it — and **cancelling closes its Resolution Center
thread permanently**. Reply to any outstanding rejection *before* cancelling.

## The EULA metadata requirement

`[verified]` **Guideline 3.1.2 auto-rejects** any app offering auto-renewable
subscriptions whose App Store product page has no functional Terms of Use
(EULA) link. It is an automated check that fires before a human looks, so it
costs a full cycle for one missing line.

Two valid routes:
- **Standard Apple EULA** → the link goes in the **App Description**:
  `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- **Custom EULA** → register it in App Store Connect instead

Check which applies: `GET /v1/apps/{id}/endUserLicenseAgreement`. `data: null`
means no custom EULA, so the standard one applies and the description link is
mandatory.

**A privacy policy URL is not a substitute.** Ours was set correctly and we were
rejected anyway.

The description should also carry, for each tier: name, duration, price per
period, trial terms, and the renewal/cancellation language. Google Play has the
equivalent requirement — use **your own** terms URL there, never Apple's
`stdeula` link.

## Testing a purchase

- **TestFlight builds always transact against the sandbox.** No charge, no real
  card, no separate sandbox account needed for a basic run. `[verified]`
- The simulator is unreliable for StoreKit; a physical-device result overrides
  any simulator conclusion. `[verified]`
- Products under review **are** purchasable in a reviewer's sandbox, so a first
  submission does not have a chicken-and-egg problem. `[inferred]`

## Checklist

- [ ] Paid Apps Agreement Active, plus propagation elapsed
- [ ] Products fetch on a physical device (prices render from StoreKit)
- [ ] Entitlement identifier matches env exactly
- [ ] Offering marked current, products attached to packages and entitlement
- [ ] Review screenshot and notes on **each** subscription
- [ ] Terms of Use (EULA) link in the App Description, returning 200
- [ ] Description states name, duration, price, trial, renewal terms
- [ ] Restore-purchases path exists and works
- [ ] Review submission contains **all four** item types
- [ ] Purchase completed end to end on a real device
