# The pre-submission gauntlet

Every item here has caused a real rejection, and **every one is checkable before
submitting**. Run `scripts/preflight.py`, then walk the manual items.

The automated checks fire before a human reviewer sees anything, so failing one
costs a full cycle for, typically, one missing line.

## Machine-checkable (preflight.py covers these)

| # | Check | Consequence if missed |
|---|---|---|
| 1 | Copyright set on the version | Submission blocked `[verified]` |
| 2 | Price schedule exists (Free counts) | Submission blocked `[verified]` |
| 3 | Age rating declaration complete | Submission blocked `[verified]` |
| 4 | At least one screenshot in the required set | Submission blocked `[documented]` |
| 5 | Review notes ≤ 4000 chars | Save fails `[verified]` |
| 6 | Demo account set if sign-in is required | 2.1 rejection `[verified]` |
| 7 | Privacy policy URL set **and returns 200** | Rejection `[documented]` |
| 8 | **Terms of Use (EULA) link in the description**, if auto-renewable subs | **Automated 3.1.2 rejection** `[verified]` |
| 9 | Every URL in the description returns 200 | Rejection `[verified]` |
| 10 | Build attached to the version | Submission blocked `[verified]` |
| 11 | Submission contains IAP items, not just the version | Rejection `[verified]` |
| 12 | Subscriptions have review screenshot + notes | Blocked `[documented]` |

## Manual, but quick

| Check | Why |
|---|---|
| Demo account signs in **from a clean device/network** | Device Trust silently blocks reviewers `[verified]` |
| Legal pages load **unauthenticated** | Middleware 404s them `[verified]` |
| Verification email arrives at a fresh address | A reviewer who cannot get a code rejects `[verified]` |
| Products fetch on a **physical device** | Simulator results are not evidence `[verified]` |
| Purchase completes end to end | `[verified]` |
| Restore purchases works | Required where purchases exist `[documented]` |
| Account deletion verified **in the database** | UI success can hide server-side resurrection `[verified]` |
| First Android run checked for status-bar overlap | `[verified]` |
| Screenshots show the app in use, not splash/login | `[documented]` |
| Review notes explain every intentional lock | Prevents "incomplete app" rejections `[verified]` |
| Notes claims verified against the code | A false claim invites deeper scrutiny `[verified]` |
| Play listing scrubbed of Apple wording | `[verified]` |

## If the app has limited review history

`[verified]` A developer account with little history will likely get **Guideline
2.1 — Information Needed** on its first submission. It is not a defect
rejection. Pre-empt it by putting all of this in the review notes *before*
submitting:

1. Purpose and target audience
2. Setup and access instructions, including why anything is gated
3. External services, tools and platforms used
4. Regional differences, or a statement that there are none
5. Regulated-industry status and third-party material rights
6. Where content **reporting** and **blocking** live, with exact tap paths

Apple may additionally request a **screen recording on a physical device**
showing registration, login, account deletion, any user-generated content with
its reporting and blocking mechanisms, and accessing paid content. Having that
recorded before the first submission saves a full round trip.

## Recording a review video

`[verified]` Hard-won specifics:

- Record a **TestFlight build of the submitted binary**. Expo Go cannot load an
  app with native modules and shows the wrong bundle id
- **Do account deletion last** — it destroys the account used for everything else
- **Registration must use an address that is not already a user.** A signup that
  fails on camera is worse than no video
- **Blocking usually needs two accounts**, since Block appears only on an
  incoming friend request or an existing friend. Plan the second account in
- Check *where* each feature is reachable before filming. Reporting may be
  scoped to a specific screen — here it rendered only on a venue leaderboard,
  not the global one, and only where another user was present
- Verify the hosting link **anonymously**, in a private window. A link requiring
  sign-in reads as non-responsive
