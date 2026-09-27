# App Store — reply to Guideline 2.1 Information Needed

Received 2026-09-27 on the first submission of Cafe Social 1.0.

**This is not a defect rejection.** Apple sends this to developer accounts with
limited review history and asks for six things. Nothing in the message identifies
a bug, a crash, or a metadata problem in our build. The "Prevent Common Issues"
block at the end is boilerplate attached to every one of these, not a list of
findings against us.

Items 2–6 are drafted below, ready to paste. **Item 1 needs you** — it is a
screen recording on a physical device, and I cannot produce it.

---

## Item 1 — Screen recording (ACTION REQUIRED, only you can do this)

Record on the iPhone 14 Pro, on the latest iOS, using a build of the submitted
version. Start the recording **before** launching the app. Apple explicitly wants
four things shown; all four exist in the app.

Suggested single take, roughly 4–6 minutes:

| # | Show | Where |
|---|---|---|
| 1 | Cold launch from the Home screen | — |
| 2 | **Account registration** — create a new account with a fresh email, receive the code, verify | Sign up → Verify your email |
| 3 | **Login** — sign out, then sign back in | Settings → sign out, then Sign in |
| 4 | Typical flow: Home, Venues map, Play, Leaderboards, Friends, Rewards hub | bottom tabs |
| 5 | **User-generated content + reporting** — show a username on a leaderboard, tap **Report** | Leaderboard → Report |
| 6 | **Blocking** — open Friends, tap **Block** on a friend | Friends → My friends → Block |
| 7 | **Accessing paid content** — open the paywall and show the two Pro tiers. **Do not attempt the purchase** — see “Why the purchase cannot be recorded” below | Me → gear → Subscription → Get Cafe Social Pro |
| 8 | **Account deletion** — Settings → Account → Delete my account, and confirm | Settings → Account |

Notes that will save you a retake:

- **Do item 8 last.** It deletes the account you used for everything above.
- Use a throwaway account, not `pzornija+appreview@gmail.com` — that one must
  keep working for the reviewer.
- Items 5 and 6 are the ones most often missed. Apple asks for content reporting
  **and** blocking mechanisms specifically; the app has `ReportPlayerScreen` and
  `PlayerBlock`, so show both.
- Item 7 is **paywall only**. The purchase cannot succeed yet and the failure
  must not appear in the recording — record the paywall, then move on.
- Upload to a stable URL (unlisted YouTube, iCloud, Dropbox) and include the link
  in the reply.

---

## Why the purchase cannot be recorded yet

Attempting it on a device returns RevenueCat **error 23** (`CONFIGURATION_ERROR`).
That is not a bug in our setup. Every link in the chain was verified against the
live APIs on 2026-09-27, not assumed:

| Check | Result |
|---|---|
| RevenueCat App Store app bundle id | `com.cafesocial.app` — matches `app.config.js` for `APP_ENV=production` |
| iOS publishable key in EAS `production` | `appl_mSQAPDNH…` — matches the only key on the App Store app |
| Shared-key override (`EXPO_PUBLIC_REVENUECAT_API_KEY`) | not set, so the iOS key wins in `nativeApiKey()` |
| App Store Connect API key | valid — list-apps and subscriptions-info permissions both pass |
| App Store subscriptions (in-app) key | valid |
| Current offering `default` | `$rc_monthly` and `$rc_annual`, each carrying the App Store product |
| Entitlement | `Cafe Social Pro` — exactly matches `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`, both products attached |
| Product status as Apple reports it | **`READY_TO_SUBMIT`** — never been through review |

The last row is the cause. Apple will not serve a first app's subscriptions to
StoreKit until they have been submitted for review with a version, and the Paid
Applications Agreement only went Active today — its propagation is separately
slow.

**This resolves itself the moment the submission goes in**, because subscriptions
under review are purchasable in the reviewer's sandbox. So the sequence is:

1. Record items 1–6 and 8, skipping the purchase.
2. Reply with the recording and items 2–6, including the paragraph below.
3. Submit — the draft submission already contains the build, the subscription
   group and both subscriptions, so Apple's “configured and submitted alongside
   the app” instruction is satisfied.

Paragraph to include in the reply:

> The two Cafe Social Pro subscriptions are submitted for review alongside this
> build, so they become purchasable in the sandbox as soon as review begins. They
> were not purchasable while the app sat in Ready for Review, which is why the
> recording shows the paywall rather than a completed transaction. If you have any
> difficulty completing the test purchase, please let us know and we will provide
> a second account with the subscription already granted.

---

## Item 2 — Purpose and target audience

> Cafe Social is a location-aware social gaming app for independent cafés.
>
> **The problem.** Independent cafés compete with chains on footfall and
> retention, and have very few tools to encourage people to come back or to stay
> longer. At the same time, people sitting alone in a café have no easy way to
> play with the other customers around them.
>
> **What the app does.** When a customer is physically inside a partner café,
> the app unlocks multiplayer word games, a short real-time arena game, daily
> challenges and a daily word puzzle. Playing earns XP, per-venue streaks and
> leaderboard position, and completing a café's challenges unlocks perks the
> customer redeems at the counter by showing a member QR code to staff. Partner
> cafés get a separate web dashboard where they configure challenges, perks and
> offers, and see visit analytics.
>
> **Value.** Cafés get a reason for customers to choose them and to return.
> Customers get something to do in the café and a reward for being a regular.
>
> **Target audience.** Adults, 18 and over, who spend time in cafés, in cities
> where we have partner venues. The app is not directed at children. A second,
> smaller audience is independent café owners and their staff, who use the
> partner portal rather than this app.

## Item 3 — Setup and access instructions

> **Demo account** (also in App Review Information):
> Email: `pzornija+appreview@gmail.com`
> Password: as supplied in the App Review Information password field.
>
> **Please read first: all gameplay is gated by design.** Games unlock in one of
> two ways: the device is physically inside a partner café's geofence with
> location permission granted, or the account has an active Cafe Social Pro
> subscription, which removes the location requirement entirely.
>
> A reviewer testing in Cupertino is not inside any partner venue — our venues
> are currently in Sarajevo, Bosnia and Herzegovina. On a free account every game
> will therefore correctly show as locked, Home will read "No partner venue
> nearby", and the "who's here" list will be empty. This is intended behaviour,
> not an incomplete app.
>
> **To reach the paid features:** Me tab → gear icon → scroll to Subscription →
> "Get Cafe Social Pro". Complete the purchase with a Sandbox Apple ID; sandbox
> purchases during review are not charged. After subscribing, Word rooms, the
> Brawler arena and the global Daily word all work from any location.
>
> **Testable from any location without subscribing:** sign up and sign in
> (email/password, Sign in with Apple, Google), the partner café map and list,
> profile with XP and tier progress, venue/city/country/global leaderboards,
> friends and parties with invite links, the rewards hub with daily and weekly
> challenges, reporting and blocking other players, language switching between
> English, German, Spanish and Croatian, and account deletion.
>
> No sample files are required.

## Item 4 — External services, tools and platforms

> **Authentication** — Clerk (clerk.com). Email/password, Sign in with Apple and
> Sign in with Google. Clerk stores the user identity; our backend stores a
> player profile keyed to the Clerk user ID.
>
> **Payments** — all consumer payments go through **Apple In-App Purchase**.
> **RevenueCat** (revenuecat.com) is used to manage and validate subscription
> entitlements on top of Apple's IAP; RevenueCat does not process payments and
> never sees card details.
>
> **Stripe** is used **only on the business side**, outside this app: we bill
> partner café owners for their own Cafe Social plan through the separate partner
> web portal. No consumer payment in this app touches Stripe, and there is no
> purchase path in the app outside Apple IAP.
>
> **Infrastructure** — Hetzner (API hosting), Supabase (managed PostgreSQL),
> Cloudflare (DNS and email routing), Expo Application Services (builds, over-the-air
> JavaScript updates, push notification delivery).
>
> **Transactional email** — Resend, for friend requests and party invitations.
>
> **Maps** — Apple MapKit, via react-native-maps, to show partner café locations.
>
> **We use no AI services, no advertising networks, no third-party analytics or
> attribution SDKs, and no data brokers.**

## Item 5 — Regional differences

> The app's features and content are identical in every region. There are no
> region-locked features, no region-specific content, and no functionality that
> is enabled or disabled by territory.
>
> The only thing that varies by location is which partner cafés are near the
> user, which is inherent to a venue-based product. Our partner venues are
> currently in Sarajevo, Bosnia and Herzegovina. A user anywhere else sees an
> empty "nearby" list and locked venue games, exactly as a user in Sarajevo would
> see if they were not inside a partner café.
>
> The interface is available in English, German, Spanish and Croatian, selected
> by device language and changeable in Settings. The subscription is offered at
> EUR 4.99 per month and EUR 34.99 per year, converted by Apple's standard
> territory price matrix.

## Item 6 — Regulated industry and third-party material

> Cafe Social does not operate in a regulated industry. It is not a financial,
> medical, gambling, or government-related service. There is no wagering, no
> real-money gaming, no loot boxes, and no randomised paid rewards — all XP and
> perks are earned deterministically.
>
> The app contains no protected third-party material:
>
> - **Word puzzle content** — written by us; the answers and hints for all four
>   languages are authored in-house.
> - **Sound effects** — Kenney (kenney.nl), released under CC0 1.0 Universal
>   (public domain dedication).
> - **Background music** — CC0-licensed tracks from OpenGameArt; attribution is
>   bundled with the app.
> - **Maps** — Apple MapKit under the standard operating system terms.
> - **Partner café names and branding** appear in the app only for cafés that
>   have a signed partnership agreement with us. No third-party brand is used
>   without permission.
>
> The Brawler arena is an abstract, cartoon-style game with no blood, gore or
> realistic injury; it is declared as Infrequent/Mild Cartoon or Fantasy Violence.

---

## Where to put this

Apple asks for the information **twice**:

1. As a **reply in App Store Connect** on the rejection — paste items 1–6 in full,
   with the recording link.
2. In the **App Review Information → Notes** field, for future submissions. That
   field is capped at 4000 characters, so it takes a condensed version rather
   than all of the above.
