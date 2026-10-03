# Overlay: advertising

**Confidence warning.** The launch this playbook comes from shipped **no ads**.
Everything here is `[documented]` or `[inferred]` — treat it as a well-researched
starting point, not as proven. Verify each claim against current Apple, Google
and AdMob policy before relying on it, and upgrade the tags once exercised.

Opinionated: AdMob. Other networks differ mainly in SDK and consent plumbing,
not in store obligations.

## Why ads are not "the easy free option"

Ads skip the Paid Applications Agreement, which makes them look cheaper than
subscriptions. They are not. They replace one long pole with a wider compliance
surface: a tracking consent prompt, materially heavier privacy declarations in
both stores, age-rating and child-audience exposure, and a separate ad-network
payment setup with its own multi-day clock.

`[inferred]` Budget roughly the same calendar time as a subscription launch, with
the risk concentrated in privacy declarations rather than in payments.

## Prerequisites

| Item | Clock |
|---|---|
| AdMob account linked to the developer account | hours `[documented]` |
| AdMob **payment profile**, address and tax info | days; identity verification by postcard in some regions `[documented]` |
| App registered in AdMob, ad unit ids created | minutes |
| A consent management platform for EEA/UK users | hours `[documented]` |

**Use test ad unit ids throughout development.** Serving live ads to your own
testing is invalid traffic and can get an AdMob account suspended — which would
block monetization entirely. `[documented]`

## App Tracking Transparency (iOS) — the big one

`[documented]` If the app collects data that tracks the user across apps or
websites owned by other companies — which personalised advertising does by
default — iOS requires the **ATT prompt** before accessing the IDFA.

- Add `NSUserTrackingUsageDescription` to the Info.plist with a specific,
  honest purpose string. A vague string is itself a rejection reason.
- Call `requestTrackingAuthorization` **before** any SDK reads the IDFA.
  Initialising an ad SDK too early can access it first.
- If the user declines, ads must still work — non-personalised.
- **Do not gate app functionality on accepting ATT**, and do not offer an
  incentive to accept. Both are rejections.
- Showing a custom "pre-prompt" explainer is allowed, but it must not be
  designed to look like Apple's own dialog, and must not discourage declining.

`[inferred]` The most common ATT rejection is a mismatch: the app shows the
prompt but the privacy labels claim no tracking, or vice versa. Make the labels,
the purpose string and actual SDK behaviour agree.

## Privacy declarations

### Apple nutrition labels `[documented]`
Personalised advertising typically forces:
- **Identifiers → Device ID**, used for **Third-Party Advertising**
- A **"Data Used to Track You"** section — this is the section ATT governs
- Possibly **Location** and **Usage Data**, depending on SDK configuration

### Play Data Safety `[documented]`
- Declare the **Advertising ID** under Device or other IDs
- On **Android 13+ (API 33) the `com.google.android.gms.permission.AD_ID`
  permission must be declared** to access the advertising id. Omit it and ads
  break on modern devices; declare it without disclosing it in Data Safety and
  the listing is rejected.
- Answer the "shared with third parties" question honestly — an ad network
  acting as an independent controller usually means **Shared = Yes**, which is
  the opposite of the processor reasoning that applies to infrastructure
  vendors.

`[inferred]` This is the sharpest difference from a no-ads app: elsewhere you
can usually argue vendors are processors and declare Shared = No. Ad networks
generally cannot be argued that way.

## Consent (EEA/UK) `[documented]`

Google requires a certified consent management platform for EEA and UK traffic.
AdMob ships the **User Messaging Platform (UMP)**. Show the consent form before
requesting ads, and respect a refusal by serving non-personalised ads.

ATT and GDPR consent are **separate** and both apply on iOS in Europe: ATT is
Apple's device-level permission, UMP is the legal basis. Implementing one does
not satisfy the other.

## Children and age rating `[documented]`

This is where ad apps get stuck for weeks.

- If the app targets, or appeals to, under-13s, the **Play Families policy** and
  **COPPA** apply: only certified ad networks, no personalised ads, no IDFA.
- Apple's Kids Category forbids third-party analytics and advertising
  altogether, except within strict limits.
- `[inferred]` Unless you specifically want a child audience, set the target age
  to 18+ (or 16+) and keep the app from reading as child-directed. Mixed signals
  — cartoon art plus a stated adult audience — invite reviewer questions.

## Ad placement rules that cause rejections `[documented]`

- Ads must not be placed where they can be tapped accidentally, or adjacent to
  interactive controls
- Interstitials must be dismissible, with a clearly visible close control
- Rewarded ads must state the reward and be genuinely opt-in
- Ads must not be injected into notifications, or appear before the app has
  shown any content
- Ad content must suit the declared age rating

## If combining ads with a subscription

`[inferred]` "Free tier has ads, paid tier removes them" is common and causes no
conflict, but the obligations **stack**: read `money-subscription.md` in full as
well. Specifically, you still need the Terms of Use (EULA) link, the
subscription metadata, and the IAPs submitted alongside the app — and you also
need every ad declaration above. Make sure that disabling ads for subscribers
actually stops the SDK initialising, or your privacy labels become wrong for
paying users.

## Checklist

- [ ] AdMob payment profile complete and verified
- [ ] Test ad unit ids used everywhere in development
- [ ] `NSUserTrackingUsageDescription` set, specific and honest
- [ ] ATT requested before any IDFA access; app fully usable if declined
- [ ] UMP (or equivalent) consent shown to EEA/UK users before ad requests
- [ ] `AD_ID` permission declared for Android 13+
- [ ] Apple privacy labels include Device ID / Third-Party Advertising and the
      tracking section
- [ ] Play Data Safety declares Advertising ID and sharing honestly
- [ ] Target age set deliberately; not inadvertently child-directed
- [ ] Ad placements reviewed against the rejection list above
- [ ] Subscribers (if any) genuinely bypass SDK initialisation
