# App Store Connect

Everything `[verified]` unless marked.

## API access

ES256 JWT signed with a `.p8` key. `scripts/asc.py` implements it. You need the
key file, its key id, and the issuer id — all from Users and Access → Integrations.

The API covers most of the version record. It does **not** cover:
- **Resolution Center replies** — browser only
- **Attaching in-app purchases to a review submission** — browser only; every
  relationship name is rejected

Budget for those two being manual.

## Field traps that each cost a cycle

| Trap | Reality |
|---|---|
| Screenshot set constant | `APP_IPHONE_67` is correct for the 6.9" display. `APP_IPHONE_69` is rejected with a 409 |
| `healthOrWellnessTopics` | A **boolean**, not an enum, despite neighbouring fields being enums |
| `ageAssurance` | Required, and effectively undocumented. Drive it off the API's own error responses |
| **Copyright** | Must be set (`2026 Your Name`) or submission fails |
| **Price schedule** | Must exist, even for a free app. Missing one blocks submission with an unhelpful error |
| Review notes | **4000 character hard cap** |
| `ageRatingDeclaration` | Hangs off **`appInfos`**, not `appStoreVersions`. The version-scoped path 404s with "the relationship does not exist" — found while writing `preflight.py` |

`[inferred]` General technique: when a field is undocumented, send a deliberately
wrong value and read the error. Apple's validation messages enumerate the
accepted values more reliably than the documentation does.

## Screenshots

- 6.9" iPhone captures satisfy the iPhone requirement; other sizes are derived
- Apple requires screenshots to show **the actual app in use** — not title art,
  not a login screen, not a splash screen `[documented]`
- Simulator captures are acceptable, and `simctl` automates them well
- `[verified]` Disable iOS autocorrect before automating text entry on a
  simulator. It silently rewrites typed email addresses, which produced
  screenshots with corrupted data that had to be recaptured.

## Review notes (4000 chars)

This field is the highest-leverage text in the whole submission, especially for
an app whose core value is not reachable in Cupertino. Include:

1. **Anything that will look broken but is intentional.** If content is gated by
   location, subscription or hardware, say so first and explicitly. A reviewer
   who finds everything locked and no explanation rejects for incompleteness.
2. Demo account credentials, and whether it is deliberately on a free tier so
   the IAP can be reviewed
3. Exact tap paths for anything Apple routinely asks about: content reporting,
   blocking, account deletion, restoring purchases
4. A demonstration video link, if one has been requested
5. External services, regional differences, third-party material

`[verified]` Keep this field accurate. A claim was made here that a feature
stayed location-locked for subscribers; the code said otherwise. Verify claims
against the code before writing them — a reviewer who catches a false statement
in the notes will look much harder at everything else.

## Demo accounts

- Must work from an unrecognised device and network — see Device Trust in
  `auth.md`
- Must keep working through the whole review. Do not use it for your own
  testing, and never delete it while demonstrating account deletion
- Store the password in the App Review Information field; it is readable back
  over the API if needed

## Review submissions

A submission is a container of **items**. For a first launch with IAPs that is
four items: the app version, the subscription group, and each subscription.

State flow: `READY_FOR_REVIEW` → `WAITING_FOR_REVIEW` → `IN_REVIEW` →
`COMPLETE`, or back to `UNRESOLVED_ISSUES` on rejection.

On rejection, everything unwinds: version `REJECTED`, subscriptions back to
`READY_TO_SUBMIT`, submission `UNRESOLVED_ISSUES`.

**After fixing metadata, use "Update Review" on the version page.** It reopens
the same submission with every item intact. Rebuilding by hand is unnecessary —
and rebuilding was required the first time only because the submission had been
cancelled.

### Cancelling is destructive
`[verified]` Cancelling a submission (`PATCH {"canceled": true}`) releases the
version so it can be re-added elsewhere — and **permanently closes that
submission's Resolution Center thread**. The reply box disappears. If there is
an outstanding rejection you still need to answer, **reply first, then cancel**.

## Verification habit

`[verified]` A user reported the app was approved; the API showed `REJECTED`,
`UNRESOLVED_ISSUES`, and zero public results. Dashboard impressions and email
subject lines are not evidence. Re-read the API before acting, and before
telling anyone a state.

## Checklist

- [ ] API key stored outside the repo and gitignored (`*.p8`)
- [ ] Copyright set
- [ ] Price schedule exists
- [ ] Age rating complete
- [ ] Screenshots show the app in use, correct set constant
- [ ] Review notes under 4000 chars, accurate, explaining all gating
- [ ] Demo account verified from a clean device
- [ ] Submission contains every required item, confirmed over the API
