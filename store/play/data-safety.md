# Google Play — Data Safety declaration (draft)

Derived from an audit of the codebase on 2026-09-26, not from assumptions. Every row
below cites where the behaviour comes from. Google rejects inaccurate Data Safety forms,
so re-verify anything marked **JUDGEMENT CALL** before submitting.

Scope: the guest app (`com.cafesocial.app`) at version 1.0.0.

---

## Data types to declare as COLLECTED

| Data type | Collected | Shared | Ephemeral | Required | Purpose | Evidence |
|---|---|---|---|---|---|---|
| Personal info → **Email address** | Yes | No | No | Yes | Account management, App functionality | `Player.email`, Clerk identifier |
| Personal info → **Name** | Yes | No | No | No (optional) | App functionality | Clerk `first_name`/`last_name` enabled, both `required=false` |
| Personal info → **User IDs** | Yes | No | No | Yes | App functionality | `Player.id`, `Player.username`, Clerk user id |
| Location → **Approximate location** | Yes | No | **Yes** | No | App functionality | `ACCESS_COARSE_LOCATION` in `app.config.js` |
| Location → **Precise location** | Yes | No | **Yes** | No | App functionality | `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`; `locationForDetect.ts` |
| App activity → **Other actions** | Yes | No | No | Yes | App functionality, Analytics | XP, challenges, game sessions, `PlayerVenueStats` |
| Device or other IDs → **Device or other IDs** | Yes | No | No | No | App functionality | `PlayerExpoPushToken.token` |
| Financial info → **Purchase history** | Yes | No | No | No | App functionality | RevenueCat + Play Billing subscription state |

### Why location can be declared "processed ephemerally"

This is the most valuable finding of the audit and materially improves the declaration.

Player coordinates are **never persisted**. `latitude`/`longitude` columns exist only on the
`Venue` model (venue data, not user data). What is stored after a location check is only:

- `Player.lastPresenceVenueId` + `lastPresenceAt` — *which venue*, not where the user is
- `PlayerVenueGeofenceEvent` — `playerId`, `venueId`, `kind`, `recordedAt`. No coordinates.

Coordinates are sent, used for geofence containment, and discarded.

> **JUDGEMENT CALL / action needed.** Coordinates are transmitted as **URL query parameters**
> (`buildDetectQuery` in `app/src/lib/locationForDetect.ts` produces `?lat=…&lng=…`). Web
> servers, proxies and CDNs commonly persist full request URLs in access logs. If the Hetzner
> nginx/API access logs retain query strings, precise location **is** being retained and the
> "processed ephemerally" claim is false. Either confirm those logs strip query strings, or
> move the coordinates into a POST body. This is worth fixing regardless of the form.

---

## Data types to declare as NOT COLLECTED

| Data type | Why |
|---|---|
| **Photos and videos** | Receipt photo upload is disabled in production — `EXPO_PUBLIC_RECEIPT_SUBMISSIONS_ENABLED=false` and `RECEIPT_SUBMISSIONS_ENABLED=false`. The `VenueReceiptSubmission.imageData` column exists but is unreachable in 1.0. **Re-declare if that flag is ever turned on.** |
| Financial info → payment info | Card details never reach the app or our servers; Apple/Google handle payment. |
| Health, fitness, messages, contacts, calendar, files, audio | No such collection; `expo-camera` is used only for QR scanning, and frames are not uploaded. |
| Web browsing history | Not collected. |

---

## Security practices section

| Question | Answer | Evidence |
|---|---|---|
| Is data encrypted in transit? | **Yes** | API is HTTPS (`https://api.cafe-social.com/api`); Clerk and RevenueCat are HTTPS-only |
| Can users request data deletion? | **Yes** | In-app: Settings → Account → Delete my account. Web: `https://partner.cafe-social.com/delete-account` |
| Committed to Play Families Policy? | **No** | Not child-directed; privacy policy states under-13s are not targeted |
| Independent security review? | **No** | None performed |

---

## Third parties

Data reaches these processors. Google's definition of *sharing* generally **excludes**
service providers processing on the developer's behalf, which is why every row above says
Shared = No.

> **JUDGEMENT CALL.** Confirm this reading. If any of these is treated as an independent
> controller rather than a processor, the corresponding rows must flip to Shared = Yes.

- **Clerk** — authentication, identity, email delivery for verification codes
- **RevenueCat** — subscription entitlement state
- **Expo push service** — notification delivery
- **Hetzner** — API hosting; **Supabase** — database hosting
- **Cloudflare** — DNS and email routing
- **Partner venues** see redemption and member-card activity at their own location only

---

## Cross-check against the iOS submission

Keep these consistent — Apple and Google compare poorly when a developer's two
declarations disagree, and journalists/researchers do compare them.

- App Store privacy nutrition labels should reflect the same set
- App Store age rating was filed as: Cartoon/Fantasy Violence = Infrequent/Mild,
  Social Media = Yes, User-Generated Content = Yes
- The Play **content rating (IARC)** questionnaire should be answered the same way

---

## Open items before this can be submitted

1. Resolve the query-string logging question above — it decides the "ephemeral" answers.
2. Confirm the processor-vs-controller reading for Clerk and RevenueCat.
3. Confirm `privacy@cafesocial.app` (the contact address on the live privacy policy) is a
   domain you own with working delivery — it differs from `cafe-social.com`.
4. Re-open this document if receipt photo upload is ever enabled.
