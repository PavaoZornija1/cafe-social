"""Pre-submission gauntlet for an App Store version.

Every check here corresponds to a real rejection or a blocked submission.
Run it before every submission.

    export ASC_KEY_PATH=~/keys/AuthKey_XXXX.p8
    export ASC_KEY_ID=XXXX
    export ASC_ISSUER_ID=<uuid>
    python3 preflight.py <appId> [--subs]

    --subs   also apply the auto-renewable-subscription checks
             (Terms of Use link, per-subscription review info)

Exit code is non-zero if any check fails, so it can gate CI.
"""
from __future__ import annotations

import re
import sys
import urllib.error
import urllib.request

import asc

NOTES_LIMIT = 4000
EULA_HINT = "apple.com/legal/internet-services/itunes/dev/stdeula"
URL_RE = re.compile(r"https?://[^\s<>\"')]+")

PASS, FAIL, WARN = "PASS", "FAIL", "WARN"
results: list[tuple[str, str, str]] = []


def record(status: str, name: str, detail: str = "") -> None:
    results.append((status, name, detail))


def http_ok(url: str) -> bool:
    """True when an anonymous GET succeeds — the reviewer's view, not yours."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "preflight/1"})
        with urllib.request.urlopen(req, timeout=25) as r:
            return 200 <= r.status < 400
    except Exception:
        return False


def editable_version(app_id: str):
    """The version currently being prepared, i.e. not already released."""
    done = {"READY_FOR_SALE", "REPLACED_BY_NEW_VERSION",
            "DEVELOPER_REMOVED_FROM_SALE"}
    for v in asc.paged(f"/v1/apps/{app_id}/appStoreVersions"):
        if isinstance(v, dict) and "ERROR" in v:
            sys.exit(f"API error listing versions: {v['body']}")
        if v["attributes"].get("appStoreState") not in done:
            return v
    return None


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    app_id = sys.argv[1]
    subs_mode = "--subs" in sys.argv

    version = editable_version(app_id)
    if not version:
        sys.exit("No editable version found for this app.")
    vid = version["id"]
    attrs = version["attributes"]
    print(f"Version {attrs.get('versionString')}  "
          f"state={attrs.get('appStoreState')}  id={vid}\n")

    # 1. copyright
    record(PASS if attrs.get("copyright") else FAIL, "Copyright set",
           attrs.get("copyright") or "missing — submission will be blocked")

    # 2. price schedule
    sched = asc.get(f"/v1/apps/{app_id}/appPriceSchedule")
    record(PASS if sched.get("data") else FAIL, "Price schedule exists",
           "" if sched.get("data") else "missing — blocks submission even when free")

    # 3. age rating — hangs off appInfos, NOT appStoreVersions. The
    # version-scoped path 404s with "the relationship does not exist".
    age_ok = False
    for info in asc.paged(f"/v1/apps/{app_id}/appInfos"):
        if asc.get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration").get("data"):
            age_ok = True
        break
    record(PASS if age_ok else FAIL, "Age rating declaration", "")

    # 4. build attached
    build = asc.get(f"/v1/appStoreVersions/{vid}/build")
    record(PASS if build.get("data") else FAIL, "Build attached", "")

    # 5/6. review detail: demo account + notes length
    detail = asc.get(f"/v1/appStoreVersions/{vid}/appStoreReviewDetail")
    d = (detail.get("data") or {}).get("attributes", {}) or {}
    notes = d.get("notes") or ""
    record(PASS if len(notes) <= NOTES_LIMIT else FAIL,
           "Review notes within 4000 chars", f"{len(notes)} chars")
    record(PASS if notes.strip() else WARN, "Review notes non-empty",
           "strongly recommended when anything is gated")
    if d.get("demoAccountRequired"):
        ok = bool(d.get("demoAccountName") and d.get("demoAccountPassword"))
        record(PASS if ok else FAIL, "Demo account credentials present", "")
    else:
        record(WARN, "Demo account not required",
               "correct only if nothing sits behind sign-in")

    # 7-9. localizations: screenshots, privacy URL, description links
    for loc in asc.paged(f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations"):
        la = loc["attributes"]
        locale = la.get("locale")
        desc = la.get("description") or ""

        sets = asc.get(f"/v1/appStoreVersionLocalizations/{loc['id']}"
                       f"/appScreenshotSets")
        record(PASS if sets.get("data") else FAIL,
               f"[{locale}] screenshots present", "")

        for url in sorted(set(URL_RE.findall(desc))):
            record(PASS if http_ok(url) else FAIL,
                   f"[{locale}] description link reachable", url)

        if subs_mode:
            record(PASS if EULA_HINT in desc or "terms" in desc.lower() else FAIL,
                   f"[{locale}] Terms of Use (EULA) link in description",
                   "Guideline 3.1.2 auto-rejects without it")

    # privacy policy url lives on appInfoLocalizations
    for info in asc.paged(f"/v1/apps/{app_id}/appInfos"):
        for il in asc.paged(f"/v1/appInfos/{info['id']}/appInfoLocalizations"):
            purl = il["attributes"].get("privacyPolicyUrl")
            if purl:
                record(PASS if http_ok(purl) else FAIL,
                       "Privacy policy URL reachable", purl)
            else:
                record(FAIL, "Privacy policy URL set", "missing")
        break

    # 10-12. subscription specifics
    if subs_mode:
        groups = list(asc.paged(f"/v1/apps/{app_id}/subscriptionGroups"))
        record(PASS if groups else FAIL, "Subscription group exists", "")
        for g in groups:
            for s in asc.paged(f"/v1/subscriptionGroups/{g['id']}/subscriptions"):
                sa = s["attributes"]
                name = sa.get("productId")
                record(PASS if sa.get("reviewNote") else WARN,
                       f"[{name}] review note set", "")
                shots = asc.get(f"/v1/subscriptions/{s['id']}"
                                f"/appStoreReviewScreenshot")
                record(PASS if shots.get("data") else FAIL,
                       f"[{name}] review screenshot set", "")

    # 11. submission contents
    subm = [s for s in asc.paged(f"/v1/reviewSubmissions?filter[app]={app_id}")
            if isinstance(s, dict)
            and s["attributes"].get("state") in {"READY_FOR_REVIEW",
                                                 "WAITING_FOR_REVIEW",
                                                 "UNRESOLVED_ISSUES"}]
    if subm:
        items = list(asc.paged(f"/v1/reviewSubmissions/{subm[0]['id']}/items"))
        n = len(items)
        if subs_mode:
            # app version + group + at least one subscription
            record(PASS if n >= 3 else FAIL,
                   "Submission includes IAP items, not just the version",
                   f"{n} items — IAPs must be submitted alongside the app")
        else:
            record(PASS if n >= 1 else FAIL, "Submission has items", f"{n}")
    else:
        record(WARN, "No open review submission", "create one before submitting")

    width = max(len(n) for _, n, _ in results) + 2
    failures = 0
    for status, name, detail in results:
        if status == FAIL:
            failures += 1
        print(f"{status:5} {name:<{width}} {detail}")
    print(f"\n{failures} failing check(s).")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
