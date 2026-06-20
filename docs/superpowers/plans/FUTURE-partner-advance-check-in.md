# Future: Advance check-in & partner map (deferred)

**Status:** Not implemented — placeholder for product discussion.

## Concept

Players announce a **planned visit** to a partner venue (time window or “later today”). Partner staff see **aggregate demand signals** on the portal (map or list): e.g. “3 guests checked in for this evening” — not necessarily live GPS on a public map.

## Why separate from polygon billing

Pay-per-visit attribution requires **verified polygon dwell** after a nudge. Advance check-in is **intent**, useful for staffing and offers, but must not auto-bill.

## Likely building blocks (TBD)

- New model or extension: `plannedArrivalAt`, `expiresAt`, `cancelledAt`, `arrivedAt` (set when polygon session opens)
- Player app: “I’m planning to visit” from venue hub
- Partner portal: map layer or sidebar widget on venue dashboard
- Privacy: default aggregate counts; optional staff view of opted-in usernames

## Related code today

- `PlayerVenueCheckIn` — explicit QR check-in gate
- `PlayerVenuePolygonSession` — actual in-venue sessions
- `DiscoveryService.friendsAtVenue` — social “here now” (different use case)

Refer to main plan: `2026-06-10-pay-per-visit-attribution.md`.
