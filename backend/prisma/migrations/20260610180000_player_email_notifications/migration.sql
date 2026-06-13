-- Player opt-out for transactional social emails (friend requests, party invites).
ALTER TABLE "Player" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
