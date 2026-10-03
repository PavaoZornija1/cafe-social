# Scripts

Both need `pip install pyjwt cryptography` and an App Store Connect API key.

```bash
export ASC_KEY_PATH=~/keys/AuthKey_XXXXXXXX.p8   # never commit this
export ASC_KEY_ID=XXXXXXXX
export ASC_ISSUER_ID=<issuer uuid>
```

Add `*.p8` to `.gitignore` before the key ever touches the repo.

## asc.py

A thin App Store Connect client. `get`, `patch`, `post`, and `paged` for
cursor-following. Error bodies are returned rather than raised, because Apple's
validation messages enumerate accepted values better than the docs do.

```bash
python3 asc.py /v1/apps
```

## preflight.py

Runs the gauntlet in `references/gauntlet.md` against a live app record.

```bash
python3 preflight.py <appId>          # free / no IAP
python3 preflight.py <appId> --subs   # auto-renewable subscriptions
```

Exits non-zero on any failure, so it can gate CI. Verified against a real
submission: 18 checks, 0 failures.

`--subs` adds the Terms of Use (EULA) check (Guideline 3.1.2), per-subscription
review screenshots and notes, and asserts the review submission carries IAP
items rather than the app version alone.

Note it fetches every URL in the description **anonymously**, which is the
reviewer's view — a link that works in your logged-in browser can still fail.
