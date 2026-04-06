-- Play-at-venue uses geofencePolygon only; radius was redundant.
ALTER TABLE "Venue" DROP COLUMN IF EXISTS "radiusMeters";
