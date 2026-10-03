# Google Play

**Confidence warning.** This track was never completed on the launch this
playbook comes from — it stalled on account verification. Most items are
`[documented]`. Do not present them to a user as proven.

## Account verification is the first blocker

`[verified]` Personal developer accounts must complete identity verification,
and the flow expects a physical Android device. With no Android hardware this
stalls indefinitely and **nothing else on Play can proceed**. Order a device on
day one.

## What Play wants that Apple does not

| Item | Notes |
|---|---|
| **Feature graphic, 1024×500** | No Apple equivalent, so it is always the forgotten asset. It is a designed banner, not a resized screenshot. Play will not publish without it `[documented]` |
| **Public account-deletion URL** | Apple accepts in-app deletion; Play wants a web page too. See `legal-pages.md` `[documented]` |
| **Data Safety form** | Far more granular than Apple's labels `[documented]` |
| **IARC content rating questionnaire** | Generates ratings for multiple territories at once `[documented]` |
| **Target age declaration** | Drives Families policy exposure `[documented]` |
| App icon as a separate 512×512 upload | `[documented]` |

## Store listing

- App name ≤ 30 chars, short description ≤ 80, full description ≤ 4000
  `[documented]`
- There is no keywords field; Play indexes the descriptions
- `[verified]` **Scrub Apple wording.** "App Store account" in a Play listing,
  or Apple's `stdeula` link, is an avoidable rejection. Keep the two listings in
  separate files and diff them deliberately rather than copying
- Subscriptions need the same terms treatment as Apple — name, duration, price,
  renewal — but with **your own** terms URL

## Data Safety

`[documented]` Google rejects inaccurate forms, so derive it from a code audit
rather than from memory. Worth knowing:

- **Processor vs controller.** Google's definition of *sharing* generally
  excludes service providers processing on your behalf, so infrastructure
  vendors are usually Shared = No. **Ad networks usually are not** — see
  `money-ads.md`.
- **"Processed ephemerally"** is a real and valuable option. If data is used in
  memory and never persisted, you may declare it ephemeral — which materially
  improves the declaration.

`[verified]` A worked example of why that needs checking: location coordinates
were sent to the API as **URL query parameters**. Web servers, proxies and CDNs
routinely log full request URLs, so if access logs retain query strings the
coordinates *are* retained and an "ephemeral" claim is false. Either confirm the
logs strip query strings, or move the coordinates into a POST body.

`[inferred]` Generalise that: before claiming ephemeral, trace where the value
appears in transport and logging, not just in your database schema.

## IARC questionnaire

`[documented]` Answer consistently with Apple's age rating; divergent
declarations across stores are hard to defend. The questions most often answered
carelessly:

- **Users can interact** — yes if there are friends, parties, chat or
  leaderboards
- **Shares user-provided content** — yes if usernames are visible to others
- **Shares user location with other users** — yes if presence is visible,
  even when coordinates are never shared or stored

## Testing tracks

`[documented]` Internal → closed → open → production. Internal testing is the
fastest and needs no review. New personal accounts may face a **closed-testing
requirement before production access**; check current policy, because it adds
weeks.

`[verified]` Before Play access exists at all, an `eas build` APK profile
installs directly on a device. See `stack-conventions.md`.

## Android-specific app bugs to pre-empt

`[verified]` Both of these were found on the very first Android run:

1. **`SafeAreaView` from `react-native` is iOS-only** — every header sits under
   the status bar. See `stack-conventions.md`.
2. **A payment SDK with no Android app configured force-closes the process on
   launch.** If the provider has no Android app, there is no `goog_` key, and a
   `test_` key against real Play Billing kills the app at startup. Create the
   Play app and the provider's Android app *before* the first Android build, or
   blank the key in that build profile.

`[inferred]` Expect the first Android run of an iOS-developed app to surface
several layout and permission issues at once. Schedule a dedicated pass rather
than treating it as a smoke test.

## Checklist

- [ ] Identity verification complete
- [ ] Feature graphic 1024×500 designed
- [ ] 512×512 icon uploaded
- [ ] Screenshots captured on an Android device or emulator
- [ ] Account-deletion URL live and public
- [ ] Data Safety derived from a code audit, ephemeral claims traced through logs
- [ ] IARC answers consistent with Apple's age rating
- [ ] Listing scrubbed of Apple wording and Apple URLs
- [ ] Payment provider has an Android app with a `goog_` key
- [ ] SafeAreaView sweep done
