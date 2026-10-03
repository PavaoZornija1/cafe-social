"""App Store Connect API client (ES256 JWT).

Requires: pip install pyjwt cryptography

Configure via environment, or edit the constants:
    ASC_KEY_PATH   path to the .p8 private key
    ASC_KEY_ID     the key id (e.g. ABCD1234EF)
    ASC_ISSUER_ID  the issuer uuid

Usage:
    python3 asc.py /v1/apps
    python3 asc.py /v1/apps/123456/appStoreVersions

    import asc
    asc.get("/v1/apps")
    asc.patch("/v1/appStoreVersionLocalizations/<id>",
              "appStoreVersionLocalizations", "<id>", {"description": "..."})
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

import jwt  # pyjwt

BASE = "https://api.appstoreconnect.apple.com"

KEY_PATH = os.environ.get("ASC_KEY_PATH", "")
KEY_ID = os.environ.get("ASC_KEY_ID", "")
ISSUER_ID = os.environ.get("ASC_ISSUER_ID", "")


def _private_key() -> str:
    if not KEY_PATH:
        sys.exit("Set ASC_KEY_PATH to your .p8 file")
    with open(os.path.expanduser(KEY_PATH)) as fh:
        return fh.read()


def tok() -> str:
    """A short-lived bearer token. Apple caps lifetime at 20 minutes."""
    now = int(time.time())
    return jwt.encode(
        {"iss": ISSUER_ID, "iat": now, "exp": now + 900,
         "aud": "appstoreconnect-v1"},
        _private_key(),
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )


def _request(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": "Bearer " + tok()}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        # Apple's error bodies enumerate accepted values far better than the
        # docs do. Always surface them rather than swallowing the failure.
        return {"ERROR": e.code, "body": e.read().decode()[:2000]}


def get(path: str):
    return _request("GET", path)


def patch(path: str, type_: str, id_: str, attributes: dict):
    return _request("PATCH", path,
                    {"data": {"type": type_, "id": id_,
                              "attributes": attributes}})


def post(path: str, body: dict):
    return _request("POST", path, body)


def paged(path: str, limit: int = 200):
    """Yield every item across pages. `path` must not already carry a cursor."""
    sep = "&" if "?" in path else "?"
    nxt = f"{path}{sep}limit={limit}"
    while nxt:
        page = _request("GET", nxt)
        if "ERROR" in page:
            yield page
            return
        yield from page.get("data", [])
        link = (page.get("links") or {}).get("next")
        nxt = link[len(BASE):] if link and link.startswith(BASE) else None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print(json.dumps(get(sys.argv[1]), indent=1)[:8000])
