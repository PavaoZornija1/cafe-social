# Pilot playbook — Cafe Social venue launch

Operational checklist for running a **single-venue or small-network pilot**. No code changes required on your side for proximity alerts: every venue gets a **100 m arrival ring** centered on the map pin when the venue is created. Owners draw the **play-area polygon** only; they do not configure nudge radius.

---

## Before go-live (platform / super admin)

1. **Venue record** — Create via admin CMS or owner onboarding. Place the **pin** at the entrance (or best reference point). Draw the **play polygon** around the indoor/outdoor play area.
2. **Proximity** — Default **100 m** circle from pin, alerts **on**. The ring **follows the pin** when it moves; saving a new pin position resets radius to **100 m** (owners cannot change this). **Super admins** can set presets (50 / 100 / 200 m) or a custom 25–500 m radius in CMS before save, or adjust again after moving the pin.
3. **Featured offer** — Required for nearby arrival pushes. Set one active featured offer with title + body in the owner portal (Offers).
4. **Weekly challenge** — Bind a challenge that completes into a **perk** (e.g. “Visit 3 days this week → free drink code”).
5. **Venue daily word** — Ensure the venue is in the word deck / daily-word scope for that city or venue list.
6. **Staff access** — At least one staff account with QR scan + perk redemption for the venue.
7. **Player marketing opt-in** — Arrival pushes only go to players with **Partner offers** notifications enabled and without **Total privacy**.

Optional env (backend `.env`):

- `PROXIMITY_ARRIVAL_PUSH_ENABLED=1` (default on; set `0` to disable all arrival pushes globally during testing)
- Daily streak-at-risk push runs on cron (see `GETTING_STARTED.md`)

---

## Owner responsibilities (what they *do* configure)

| Item | Where | Notes |
|------|--------|--------|
| Map pin + play polygon | Owner portal → venue map | Pin must sit **inside** polygon |
| Featured offer | Offers | Drives nearby push copy + home “Featured” |
| Weekly challenge + perk reward | Challenges / perks | Retention loop on Home “While you’re here” |
| Campaign pushes (optional) | Campaigns | Max cadence per venue; deep-link to hub |
| Venue daily word content | Via platform word deck | Streak shown on Home when at venue |
| Staff QR redemption | Staff app / portal | Member card + perk codes |

Owners **do not** set arrival radius or toggle proximity rings (super-admin CMS only).

---

## Player experience (what to expect in pilot)

### Home — “While you’re here” (when detected at venue)

- Visit days this week / last 30 days
- Active weekly challenge + progress bar + reward hint
- Unredeemed perks waiting for staff
- Venue daily word streak / attempts
- Short venue activity feed + link to **Venue hub**

### Nearby arrival push (approaching, not inside)

- Fires on **OS geofence enter** into the 100 m ring (background, “Always” location if granted)
- **Guardrails:** partner marketing opt-in; not already “at venue”; **1 push per venue per UTC day**; **2 pushes total per day** across all venues; venue must have featured offer copy
- Tap opens **Venue hub** with offer context

### Dwell / in-venue nudges

- Separate from arrival ring — tied to presence inside play polygon and product rules (order nudge, campaigns, streak-at-risk for daily word)
- Do not expect an arrival push if the player is already checked in / present at that venue

---

## Staff / counter flow

1. Player shows **member QR** (Settings → Member card) or perk redemption screen.
2. Staff scans in **Staff QR scan** → links visit / validates member.
3. Player completes challenge → earns perk → **Redeem perk** shows code; staff confirms in **Staff redemptions**.

Train staff: arrival push is marketing only; redemption always goes through staff scan or perk code.

---

## Week 1 — suggested cadence

| Day | Action |
|-----|--------|
| **Mon** | Publish featured offer + weekly challenge; smoke-test pin/polygon on site |
| **Tue–Wed** | 1 test device: walk toward venue from 150 m out with background location; confirm ≤1 arrival push |
| **Thu** | Optional owner **campaign** push (e.g. weekend hours); verify deep link to hub |
| **Fri–Sun** | Monitor visit-day counts, perk redemptions, daily-word solves |

---

## Metrics to watch (admin / owner dashboard)

- **Visit days** per venue (engagement API / reports)
- **Challenge completions** and **perk redemptions**
- **Venue daily word** attempts and streaks
- **Campaign send** counts (if used)
- **ProximityArrivalPushLog** rows (backend) — should stay ≤1 per player per venue per day

Red flags: zero featured offer (no arrival pushes); pin far from entrance (false negatives); polygon too small (players not “at venue” on Home).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| No arrival push | No featured offer, marketing opt-out, or already at venue | Add offer; check player settings; walk from outside 100 m |
| Push but no deep link | Old app build | Update app; payload type `venue_proximity_arrival` |
| Home panel empty at venue | Not inside polygon / detection off | Fix polygon; location permission |
| Too many pushes | Should not happen (caps) | Check logs; report to platform |
| iOS never alerts | Background location not granted | Settings → enable “Always” for partner alerts copy |

---

## Pilot sign-off checklist

- [ ] Pin accurate; polygon covers play area
- [ ] Featured offer live with clear title/body
- [ ] Weekly challenge → perk wired and tested end-to-end
- [ ] Staff trained on QR + redemption
- [ ] One successful arrival push test from outside 100 m
- [ ] One in-venue Home panel showing visit stats + challenge
- [ ] hr / de / es copy reviewed if venue is non‑English market

For local setup see `GETTING_STARTED.md`. For API details see `README.md`.
