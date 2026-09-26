# Google Play — App content answers (draft)

Play's "App content" section. Answers are aligned with what was filed at Apple
for iOS 1.0, because inconsistent declarations across the two stores invite
scrutiny and are hard to defend.

---

## App access

Play asks whether any part of the app is restricted. **It is** — all gameplay is
location- or subscription-gated, so a reviewer opening the app cold sees
everything locked. Say so explicitly; this is the same risk that drove the
rewrite of the Apple review notes.

Select: **All or some functionality is restricted**

Add one instruction set:

- **Name:** Demo account (email + password)
- **Username:** `pzornija+appreview@gmail.com`
- **Password:** *(same as the App Store demo account — do not paste into any
  document; copy from your password manager)*

**Instructions:**

```
IMPORTANT — ALL GAMEPLAY IS GATED BY DESIGN. PLEASE READ FIRST.

Games unlock in one of two ways:
1) The device is physically inside a partner cafe's geofence, with location
   permission granted, or
2) The account has an active "Cafe Social Pro" subscription, which removes the
   location requirement entirely.

A reviewer testing remotely is not inside any partner venue. On a free account,
every game will therefore show as locked, Home will read "No partner venue
nearby", and the "who's here" lists will be empty. This is intended behaviour,
not a broken app.

TO TEST GAMEPLAY
The demo account above is on the free tier so that you can review the in-app
purchase. To unlock play at your location:
  Me (tab) > gear icon (top right) > scroll to "Subscription" > "Get Cafe Social Pro"
Use a licence-tested account; test purchases are not charged. The product is an
auto-renewing subscription with a 7-day free trial.

After subscribing, all of these work from any location:
  - Play (tab) > Word rooms
  - Play (tab) > Brawler
  - Play (tab) > calendar icon > Daily word > "Global" tab

TESTABLE WITHOUT A SUBSCRIPTION, FROM ANY LOCATION
  - Sign in and sign up: email + password, Sign in with Google, Sign in with Apple
  - Venues: partner cafe map, nearby list, search and filters
  - Me: profile, lifetime XP, tier progress, stats
  - Leaderboards: Venue, City, Country and Global
  - Friends: add by username, requests, friend QR, parties and invite links
  - Rewards hub: daily and weekly challenges
  - Settings: language (English, German, Spanish, Croatian), privacy and
    discoverability toggles, notification categories, Legal & data, and
    account deletion

If you have any difficulty completing the test purchase, contact us and we can
enable a pre-subscribed account for review.
```

> **Differs from the Apple version:** Apple's notes say "Sandbox Apple ID" and
> "sandbox purchases are free". Play's equivalent is a **licence-tested account**
> added under Setup → License testing. Do not leave Apple's wording here.

---

## Content rating (IARC questionnaire)

Filed at Apple as: Cartoon/Fantasy Violence = Infrequent/Mild, Social Media =
Yes, User-Generated Content = Yes, everything else None. Keep Play consistent.

| Question | Answer | Reasoning |
|---|---|---|
| Category | **Game** (not "App") | Play routes to a different questionnaire; the primary activity is games |
| Violence — does the app contain violence? | **Yes, mild / cartoon-like** | The Brawler arena: "short arena battles with heroes and power-ups". Abstract, no blood, no realistic injury |
| Sexuality | No | |
| Language | No | |
| Controlled substances | No | |
| Gambling — simulated or real | **No** | No wagering, no loot boxes, no randomised paid rewards. XP and perks are earned deterministically |
| Crude humour / horror | No | |
| **Users can interact** | **Yes** | Friends, parties, leaderboards, presence at venues |
| **Shares user-provided content** | **Yes** | Usernames and party names are visible to other users |
| **Shares user location with other users** | **Yes** | Other players can see you are at a venue — **but only when discoverable**; Settings has "Discoverable" and "Total privacy (solo mode)" toggles |
| Allows purchases of digital goods | **Yes** | Cafe Social Pro subscription |

> The location-sharing answer is the one most likely to be answered carelessly.
> Presence at a venue is visible to others, so "Yes" is correct even though
> coordinates are never shared or stored.

---

## Target audience and content

- **Target age groups:** 18+ (or 16+ if you'd rather). Deliberately **not**
  13–17 or under: the privacy policy states the app is not directed at children
  under 13, the app has location features and user interaction, and including
  minors pulls you into the Families policy and stricter ads/data requirements
  for no benefit.
- **Appeals to children?** No.
- **Ads:** **No ads.** The app contains no ad SDK — confirmed, `package.json`
  has no AdMob or equivalent.

## Other declarations

| Declaration | Answer |
|---|---|
| Contains ads | No |
| In-app purchases | **Yes** — subscription, EUR 4.99/month and EUR 34.99/year |
| Government app | No |
| Financial features | **None apply.** The subscription is a digital good billed by Play, not a financial product |
| Health apps | No |
| Data safety | See `data-safety.md` |
| News app | No |
| COVID-19 contact tracing | No |

---

## Cross-store consistency check

Before submitting, confirm these still match the App Store record:

- Subscription price: EUR 4.99 / month, EUR 34.99 / year, 7-day free trial
- The app is **free to download** with IAP (App Store price was set to Free)
- Privacy policy URL: `https://partner.cafe-social.com/privacy`
- Account deletion URL: `https://partner.cafe-social.com/delete-account`
- Support contact — note the live privacy policy prints
  `privacy@cafesocial.app`, a different domain from `cafe-social.com`. Confirm
  it is yours and delivers before publishing it in a second store.
