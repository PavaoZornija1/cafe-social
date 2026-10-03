# Day one: everything with an external clock

Start all of these before writing product code. None needs a finished app, and
each one blocks something later.

Durations are measured from the Cafe Social launch unless tagged otherwise.

| # | Item | Clock | Blocks |
|---|---|---|---|
| 1 | Apple Developer Program enrolment | 1–2 days, longer for orgs `[documented]` | Everything Apple |
| 2 | Google Play Developer account + **identity verification** | days to weeks `[verified]` | Everything Play |
| 3 | **Paid Applications Agreement** (skip if free, no IAP) | **~5 days after bank details** `[verified]` | *All* StoreKit product fetches |
| 4 | Domain registration + DNS propagation | hours `[verified]` | Auth, email, legal pages |
| 5 | Auth provider production instance + domain verification | hours `[verified]` | Any production sign-in |
| 6 | Transactional email domain verification (SPF/DKIM/DMARC) | hours `[verified]` | Verification codes, invites |
| 7 | AdMob account + payment setup (ads only) | days `[documented]` | Live ads; test ads work sooner |
| 8 | A physical device of **each** platform | however long shipping takes `[verified]` | Play verification, App Review recordings, purchase testing |

## The ones that actually bit

### Paid Applications Agreement — the worst offender
`[verified]` Without it active, StoreKit returns **zero** products, so RevenueCat
reports a configuration error and every paywall is dead. It is not enough to
accept the agreement: it needs tax forms **and a bank account**, and after the
dashboard says *Active* there is a further multi-day propagation before products
actually start being served. Measured here: bank account added 27 Sep, products
first fetched 2 Oct.

Diagnostic consequence: **if the agreement went active recently and products
still do not fetch, wait rather than rewiring configuration.** Days were lost
re-verifying correct settings.

Bosnia-specific worked example: the bank account needs IBAN + SWIFT/BIC. BA IBANs
are `BA` + 2 check + **3 bank** + 3 branch + 8 account + 2 national check. The
*Šifra Banke* is the branch-specific code, not the bank's headline code — here
the correct value was `194153`, and `194001` was rejected. `[verified]`

### Play identity verification
`[verified]` Personal Play accounts must verify identity, and the flow expects a
physical Android device. Without a device this stalls indefinitely. If no Android
hardware is to hand, **order one on day one** — this blocked the entire Android
track on the launch this came from.

### A physical device of each platform
`[verified]` Needed for more than testing:
- App Review may demand a **screen recording on a physical device** (see
  `rejections.md`, Guideline 2.1). A simulator recording will not satisfy it.
- Sandbox/TestFlight purchases behave differently from the simulator.
- Play identity verification.

## Suggested day-one ordering

Fire these off in parallel; none depends on another:

1. Register the domain, point nameservers at your DNS provider
2. Enrol in both developer programs
3. If the app will ever charge money: start tax forms **and** bank details now,
   even before the app exists
4. Start Play identity verification
5. Create the auth provider production instance and add the custom domain, so
   verification can start
6. Add the sending domain to the email provider so DNS records can propagate
7. If using ads: create the AdMob account and start payment setup

## Rough critical path

`[inferred]` from this launch, assuming no product-code delays:

- **Free app, no IAP, no ads:** ~1 week to first submission. Nothing on the
  list above except 1, 2, 4, 5, 6 applies, and none exceeds a day or two.
- **Subscription or one-time:** ~2 weeks minimum, dominated by item 3.
- **Ads:** ~2 weeks, dominated by items 2 and 7 plus heavier privacy review.

The gap between the free case and the paid case is almost entirely the Paid
Applications Agreement. If the goal is to validate a product quickly, shipping
free first and adding monetization in v1.1 avoids the longest pole.
