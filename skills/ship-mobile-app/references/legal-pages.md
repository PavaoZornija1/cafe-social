# Legal pages

Three public pages. All three must be reachable with **no sign-in, no app
install, no redirect**, from a browser anywhere in the world.

| Page | Required by | URL used here |
|---|---|---|
| Privacy policy | Both stores, always | `/privacy` |
| Terms of service | Both stores; **mandatory link in metadata if you sell subscriptions** | `/terms` |
| Account deletion | Play, and Apple 5.1.1(v), whenever accounts can be created | `/delete-account` |

## The middleware trap

`[verified]` These pages typically live in the same web app as your authed
dashboard, and a catch-all `auth.protect()` will 404 them for exactly the
audience that needs them — a store reviewer who is not signed in.

Add every legal route to the public matcher, with a comment explaining why, or
someone will "tidy" it away later:

```ts
const isPublicRoute = createRouteMatcher([
  "/privacy(.*)",
  "/terms(.*)",
  // Google Play requires the account-deletion page to be reachable without
  // signing in or installing the app; auth.protect() would 404 those visitors.
  "/delete-account(.*)",
]);
```

**Verify from outside your session.** `curl` with no cookies, or a private
window. A page that works for you while logged in proves nothing.

```bash
for u in /privacy /terms /delete-account; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -L "https://app.example.com$u")  $u"
done
```

## What the account-deletion page must say

`[documented]` Google's requirement is specific. The page must state:

- How to request deletion **in the app** (exact path), and **off the app**
  (an email address or web form) — off-app matters because someone who has
  uninstalled must still be able to ask
- Which data is deleted
- Which data is retained, and for how long, and why (legal/accounting holds)
- That store subscriptions are billed by Apple/Google and **are not cancelled
  by deleting the account** — users must cancel in their store account

That last point protects you from chargeback complaints and is easy to forget.

## Deployment traps

`[verified]` A `vercel.json` containing

```json
"ignoreCommand": "git diff --quiet HEAD^ HEAD -- ."
```

inspects only the **tip commit**. Push several commits where the last one does
not touch that directory and the deploy is silently skipped. Here it meant the
legal pages 404'd in production for weeks while the repo looked correct.

The symptom is a `CANCELED` deployment, which resembles a paused project. **Read
the deployment's error link, not just its status** — misdiagnosing this as a
paused project wasted real time.

If you keep an ignore command, make it diff against the last *successful
deploy*, not `HEAD^`.

## Consistency across stores

`[verified]` Keep one source of truth. Reviewers and journalists do compare the
two stores' declarations, and inconsistency invites scrutiny. Specifically:

- The privacy policy URL in App Store Connect and Play Console must match
- Apple's privacy nutrition labels and Play's Data Safety form must describe the
  same collection
- Age rating answers must match across the IARC questionnaire and Apple's

## Checklist

- [ ] All three pages deployed and returning 200 **unauthenticated**
- [ ] Routes added to the public matcher, with a comment
- [ ] Deletion page covers in-app path, off-app path, deleted, retained, and the
      store-subscription caveat
- [ ] Every email address printed on the pages exists and delivers
- [ ] Privacy policy URL set identically in both consoles
- [ ] No ignore-command silently skipping deploys
