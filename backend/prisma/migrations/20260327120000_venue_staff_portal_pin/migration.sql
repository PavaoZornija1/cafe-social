-- Optional PIN (stored as PBKDF2 hash) for venue staff portal — verify perk redemptions without admin API key.
ALTER TABLE "Venue" ADD COLUMN "staffPortalPinHash" TEXT;
