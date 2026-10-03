# Overlay: one-time payment

Covers **non-consumable** (unlock forever: pro upgrade, remove ads),
**consumable** (spendable: credits, extra play time), and **paid-upfront**
(the download itself costs money).

Read `money-subscription.md` first — the Paid Apps Agreement chain, the Error 23
diagnosis order, and the "submit IAPs alongside the app" rule are identical and
are not repeated here.

## What differs from subscriptions

| | Subscription | One-time |
|---|---|---|
| Terms of Use (EULA) link in metadata | **Mandatory** (3.1.2) `[verified]` | Not required `[documented]` |
| Renewal/duration/price in description | Mandatory | Not required |
| Subscription group | Required | N/A |
| Restore purchases | Required | **Required for non-consumable** `[documented]` |
| Review screenshot per product | Required | Required `[documented]` |
| Billing retry / grace period | Applies | N/A |
| Family Sharing option | Available | Available for non-consumable |

The EULA exemption is the main saving. Everything about the agreement, the
bank account and the propagation delay is unchanged — **the longest pole is
identical**.

## Non-consumable vs consumable

Choose deliberately; it cannot be changed after the product is created.

- **Non-consumable** — bought once, owned forever, **must be restorable** on a
  new device. Apple rejects apps that sell a permanent unlock with no visible
  Restore Purchases control. `[documented]`
- **Consumable** — spent and re-bought. **Not** restorable; your backend owns
  the balance. Never store a consumable balance only on-device: reinstalling
  would wipe paid-for credits, which generates refund demands.

`[verified]` A mixed catalogue is fine — the launch this came from had both a
subscription and consumable "play time" products in the same app.

## Paid-upfront

`[documented]` The app costs money to download; often there is no IAP at all.

- Set the price tier in the price schedule instead of Free
- The Paid Apps Agreement is **still required** — it governs all money, not just
  IAP
- No EULA link requirement unless you also sell auto-renewable subscriptions
- There is no trial mechanism. The usual workaround is a free app with a
  non-consumable unlock, which is why paid-upfront is now rare
- Expect more scrutiny that the app is complete and functional: a reviewer who
  pays nothing still evaluates whether the price is honestly represented

## Consumables and the entitlement model

`[inferred]` Entitlement-based providers model "does this user have access"
cleanly for non-consumables and subscriptions, but consumables are a balance,
not a boolean. Record the grant server-side, keyed by the transaction id, and
make the grant idempotent — store callbacks can and do arrive twice.

## Checklist

- [ ] Paid Apps Agreement Active, plus propagation elapsed
- [ ] Product type (consumable vs non-consumable) deliberately chosen
- [ ] Restore Purchases visible and working (non-consumable)
- [ ] Consumable balances held server-side, grants idempotent by transaction id
- [ ] Review screenshot and notes per product
- [ ] Products included in the review submission **alongside** the app version
- [ ] Purchase completed end to end on a real device
- [ ] Price schedule set (Free with IAP, or the chosen tier for paid-upfront)
