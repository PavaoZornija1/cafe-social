# Auth in production (Clerk)

Opinionated: Clerk. The traps generalise — any hosted auth provider with a
custom domain and native SDKs has equivalents.

## Dev and production are the same app, different instances

`[verified]` A Clerk *application* contains both a development and a production
*instance*. They have separate keys, separate user pools, separate settings.

Consequences that cost time here:
- Configuring social sign-in on dev does nothing for production. Every provider
  credential must be added **again** on the production instance.
- `pk_test_` / `sk_test_` are dev; `pk_live_` / `sk_live_` are production.
  Shipping a store build with a test key means a working app and an empty user
  pool.
- Do not conclude from two sets of keys that there are two applications. That
  mistake was made and corrected here.

## Custom domain

Production requires one. See `domain-email.md` for the **Error 1000** trap,
which is the single most disruptive thing in this document — it takes every
production sign-in down and looks exactly like a DNS error.

## Device Trust blocks App Review

`[verified]` Clerk's Device Trust challenges sign-ins from unrecognised devices.
An App Review demo account is, by definition, always signing in from an
unrecognised device — a reviewer in Cupertino hits a challenge, cannot pass it,
and rejects the app as broken. The sign-in returns status `needs_client_trust`.

**Turn Device Trust off before submitting.** If it is wanted for real users,
re-enable it only after approval, and remember it will break the next review
round too.

## Native Sign in with Apple needs a second registration

`[verified]` This is the subtle one. Configuring the Apple SSO *credentials* in
Clerk makes the **web** flow work. The **native** iOS flow additionally requires
registering the app under Clerk's **Native applications** section with its bundle
identifier. Without it, native Apple sign-in fails while web Apple sign-in
succeeds — which looks like an app bug and is not.

Also required:
- Add `yourscheme://sso-callback` to the allowed redirect origins. `[verified]`
- Apple Guideline 4.8: if you offer any third-party sign-in (Google, Facebook),
  you must also offer Sign in with Apple. `[documented]` Not offering it is a
  rejection.

Sign in with Apple needs a paid Apple Developer team to provision the
entitlement, so a personal-team local build cannot use it. Gate it by
environment rather than trying to make it work everywhere:

```js
const appleSignInEnabled =
  appEnv === 'production' || appEnv === 'preview' || appEnv === 'staging';
```

## Secrets handling

`[verified]` Apple's Sign in with Apple `.p8` private key and Google's OAuth
client secret are both pasted into the auth provider's dashboard. **An agent
should decline to handle these and ask the user to paste them**, even when the
user offers authorization — they are long-lived credentials whose exposure in a
transcript is not recoverable by rotation alone.

The same applies to bulk secret pulls (`eas env:pull production` and
equivalents). Pull the specific publishable values you need instead.

## The auth-shaped bug that is not auth

`[verified]` On the launch this came from, "sign-in does nothing" turned out to
be the Cloudflare cert problem, not the app. Before debugging client code:

1. Does the auth hostname serve a cert naming that hostname?
2. Is the production instance's domain **verified** in the dashboard?
3. Is the build using a `pk_live_` key?
4. Is Device Trust on?

All four are checkable in minutes and cover the majority of "auth is broken".

## Account deletion must actually delete

`[verified]` Apple 5.1.1(v) and Play both require in-app account deletion. A
subtle failure found here: deletion removed the user row and the auth-provider
user, then **a trailing authenticated request recreated the row**, because every
read endpoint provisioned through a `findOrCreateByEmail` helper and the JWT
stayed valid for a short while after the user was deleted.

The UI showed a correct confirm-and-sign-out flow, so this was invisible without
checking the database.

Guard against it:
- Write a tombstone on delete, and refuse to provision against one.
- Where the identity key is derived from the auth provider's user id (ids are
  never reused), the refusal can be permanent. Where it is a real email address,
  bar it only briefly — long enough to outlive a pre-delete JWT.
- **Audit every call site that auto-provisions.** There were seven here.

## Checklist

- [ ] Production instance exists; custom domain **verified**, cert correct
- [ ] Build uses `pk_live_`
- [ ] Social providers configured on the **production** instance
- [ ] Native applications entry added with the bundle id (native Apple sign-in)
- [ ] `yourscheme://sso-callback` in allowed redirects
- [ ] Sign in with Apple offered if any third-party sign-in is (4.8)
- [ ] Device Trust **off** for review
- [ ] Demo account created, signed in from a clean device, and verified working
- [ ] Account deletion verified **in the database**, not just the UI
