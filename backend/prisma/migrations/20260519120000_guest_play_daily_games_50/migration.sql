-- Raise guest daily game cap to 50 for all venues and organizations.
UPDATE "VenueOrganization" SET "guestPlayDailyGamesLimit" = 50;
UPDATE "Venue" SET "guestPlayDailyGamesLimit" = 50;
