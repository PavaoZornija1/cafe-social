# Domain, DNS and email

Opinionated: Cloudflare DNS, Resend for transactional mail. Provider-specific
steps are marked so a swap is obvious.

## Subdomain map

Decide this once, on day one, because auth and email both bake it in.

| Host | Purpose | Notes |
|---|---|---|
| `example.com` | Marketing site | |
| `app.example.com` or `partner.example.com` | Web dashboard **and legal pages** | Legal pages must be public |
| `api.example.com` | Backend API | |
| `clerk.example.com` | Auth provider frontend API | Exact name dictated by the provider |
| `accounts.example.com` | Hosted sign-in pages | |
| `mail.example.com` / `send.example.com` | Transactional sending domain | Keep separate from the apex so a deliverability problem cannot poison the main domain |

**Put legal pages on a host that is already public.** Hosting them behind the
dashboard's auth is the single easiest way to fail both store reviews — see
`legal-pages.md`.

## The Cloudflare proxy trap

`[verified]` **Error 1000 "DNS points to prohibited IP"** on an auth provider's
custom domain.

Cause: the provider uses Cloudflare-for-SaaS. Until the domain is **verified on
the provider's side**, no custom-hostname certificate is issued, and the
request falls through to your zone's wildcard — which Cloudflare refuses to
serve for a hostname it does not own. Every production sign-in 403s.

How to tell it apart from a DNS mistake: inspect the served certificate. If it
is your zone's wildcard rather than one naming the auth hostname, the custom
hostname was never provisioned, and the DNS records are a red herring.

```
openssl s_client -connect clerk.example.com:443 -servername clerk.example.com \
  </dev/null 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName
```

Fix: click **Verify records** in the provider dashboard and wait for the cert.
Do not start changing DNS records.

## Email

### Transactional (verification codes, invites)
`[verified]` Resend. Add the sending domain, then publish the SPF, DKIM and
DMARC records it generates. Verification codes failing to arrive is
indistinguishable from broken auth during review, so test this end to end
*before* submitting — a reviewer who cannot receive a code will reject.

Set DMARC to at least `p=none` with a reporting address on day one; tightening
later is easy, retrofitting during an outage is not.

### Inbound
Cloudflare Email Routing is enough for a small product: forward
`support@`, `privacy@` and `legal@` to a real inbox. All three appear in store
metadata and privacy policies, and **Apple and Google both check that the
support contact works** `[documented]`.

### The address in your privacy policy must be real
`[verified]` Our live privacy policy printed `privacy@cafesocial.app` while the
project's actual domain was `cafe-social.com` — a different domain entirely.
Publishing an address you do not control in two app stores is a genuine
liability. Grep the deployed legal pages for every address and URL and verify
each one resolves and delivers.

### Apple private email relay
`[documented]` If Sign in with Apple is offered, users may hide their address
and Apple relays mail through `privaterelay.appleid.com`. For that relay to
accept your mail, **the sending domain and its bounce address must be registered
in the Apple Developer portal** under Certificates, Identifiers & Profiles →
More → Configure Sign in with Apple for Email Communication.

Register both the sending domain and the bounce subdomain your email provider
uses (Resend's looks like `bounces+<id>@<your-sending-domain>`). Miss this and
mail to hidden-relay users silently bounces — including verification codes,
which means those users can never complete sign-up.

This was still outstanding at the end of the Cafe Social launch. Do it early.

## Checklist

- [ ] Domain registered, nameservers delegated
- [ ] Subdomain map decided and recorded in the repo
- [ ] Legal pages host is publicly reachable with no auth
- [ ] Auth provider custom domain **verified**, cert names the hostname
- [ ] Sending domain verified; SPF, DKIM, DMARC published
- [ ] `support@`, `privacy@`, `legal@` route to a real inbox
- [ ] Every address and URL printed in the legal pages resolves and delivers
- [ ] Apple private relay sending + bounce domains registered (if Apple sign-in)
- [ ] End-to-end test: fresh sign-up on a real device receives its code
