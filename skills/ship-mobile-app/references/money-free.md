# Overlay: completely free

No in-app purchases, no ads, no paid download. **This is dramatically the
easiest path and the fastest to ship** — most of what makes store launches
painful simply does not apply.

## What you skip entirely

| Not needed | Why it matters |
|---|---|
| **Paid Applications Agreement** | The single longest pole — ~5 days, bank account, tax forms `[verified]` |
| Bank account and tax forms | Including the country-specific IBAN/SWIFT friction |
| Any payment provider (RevenueCat, StoreKit, Play Billing) | |
| IAP products, pricing, localizations, review screenshots | |
| Terms of Use (EULA) link in metadata | Mandatory only for auto-renewable subscriptions `[verified]` |
| Subscription metadata (duration, price, renewal terms) | |
| Purchase-restore flow | Apple requires one wherever purchases exist `[documented]` |
| Ad SDK, ATT prompt, ad-related privacy declarations | |

## What still applies

Everything that is not about money:

- Both developer accounts, and **Play identity verification** — still the main
  clock `[verified]`
- Domain, DNS, email — `domain-email.md`
- Auth in production — `auth.md`
- Privacy policy, terms, **account deletion** if accounts exist — `legal-pages.md`
- Screenshots, age rating, **copyright**, and a **price schedule set to Free**
- Privacy nutrition labels and the Play Data Safety form, reflecting whatever
  you actually collect
- Apple Guideline 2.1 for accounts with limited review history — the demo
  account, the information request, possibly a screen recording. See
  `rejections.md`

## Still required even though nothing is sold

`[verified]` These were each a real blocker here and are easy to assume away:

- **A price schedule must exist**, set to Free. A version cannot be submitted
  without one — the submission simply fails with an unhelpful error.
- **Copyright must be set** on the version, e.g. `2026 Your Name`.
- **Account deletion** is required by both stores whenever accounts can be
  created, free or not.
- A **demo account** if any content sits behind sign-in.

## Strategy note

`[inferred]` The gap between this overlay and the subscription overlay is almost
entirely the Paid Applications Agreement and IAP review. If the goal is to
validate a product, **ship free first and add monetization in v1.1**. The
agreement can be progressing in the background while v1.0 is already live, and
you avoid having your first-ever review round include an IAP — which is when
Apple scrutinises a new developer account most heavily.

## Checklist

- [ ] Price schedule exists and is Free
- [ ] Copyright set
- [ ] Legal pages live and public
- [ ] Account deletion works, verified in the database
- [ ] Demo account provided if anything is behind sign-in
- [ ] Privacy labels / Data Safety match actual collection
- [ ] No ad SDK and no IAP code left in the bundle — a stray StoreKit call or
      ad identifier contradicts your declarations
