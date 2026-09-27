-- Phase 1 of "Shared cellars" (FUTURE_CAPABILITIES.md): the cellar moves
-- from belonging to a person to belonging to their Domaine, so every
-- member of one Domaine shares it. Same nullable-backfill-lock pattern as
-- 20260928040000_domaine_and_membership, and one transaction for the same
-- reason: no window where some rows have a Domaine and others don't.
--
-- Every backfill below copies the Domaine of the row's existing owner,
-- and every existing User was given their own Domaine by that previous
-- migration - so nothing that was separate before this migration is
-- shared after it. Sharing only starts with the next invite that says so.

-- 1. The ownership roots and the research job each get their Domaine.
ALTER TABLE "Bottle" ADD COLUMN "domaineId" TEXT;
ALTER TABLE "TastingFlight" ADD COLUMN "domaineId" TEXT;
ALTER TABLE "SavedPairing" ADD COLUMN "domaineId" TEXT;
ALTER TABLE "ResearchJob" ADD COLUMN "domaineId" TEXT;

UPDATE "Bottle" b SET "domaineId" = u."domaineId" FROM "User" u WHERE u."id" = b."ownerId";
UPDATE "TastingFlight" f SET "domaineId" = u."domaineId" FROM "User" u WHERE u."id" = f."ownerId";
UPDATE "SavedPairing" p SET "domaineId" = u."domaineId" FROM "User" u WHERE u."id" = p."ownerId";
UPDATE "ResearchJob" j SET "domaineId" = u."domaineId" FROM "User" u WHERE u."id" = j."ownerId";

ALTER TABLE "Bottle" ALTER COLUMN "domaineId" SET NOT NULL;
ALTER TABLE "TastingFlight" ALTER COLUMN "domaineId" SET NOT NULL;
ALTER TABLE "SavedPairing" ALTER COLUMN "domaineId" SET NOT NULL;
ALTER TABLE "ResearchJob" ALTER COLUMN "domaineId" SET NOT NULL;

ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TastingFlight" ADD CONSTRAINT "TastingFlight_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPairing" ADD CONSTRAINT "SavedPairing_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Bottle_domaineId_idx" ON "Bottle"("domaineId");
CREATE INDEX "TastingFlight_domaineId_idx" ON "TastingFlight"("domaineId");
CREATE INDEX "SavedPairing_domaineId_idx" ON "SavedPairing"("domaineId");
CREATE INDEX "ResearchJob_domaineId_idx" ON "ResearchJob"("domaineId");

-- 2. ownerId on the three roots becomes "who added it": nullable, and
--    SET NULL rather than CASCADE, so removing one member of a shared
--    Domaine can never delete the cellar everyone else is using.
--    ResearchJob keeps its CASCADE - a transient job row, not anyone's
--    things.
ALTER TABLE "Bottle" DROP CONSTRAINT "Bottle_ownerId_fkey";
ALTER TABLE "Bottle" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TastingFlight" DROP CONSTRAINT "TastingFlight_ownerId_fkey";
ALTER TABLE "TastingFlight" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "TastingFlight" ADD CONSTRAINT "TastingFlight_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedPairing" DROP CONSTRAINT "SavedPairing_ownerId_fkey";
ALTER TABLE "SavedPairing" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "SavedPairing" ADD CONSTRAINT "SavedPairing_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Invites belong to the Domaine that sent them, and say what they
--    grant. Every invite so far was sent from the one /invites page of
--    the original cellar - the earliest User's Domaine - and meant "a
--    cellar of your own", i.e. "separate". The one exception is each
--    Domaine founder's own invite (the bootstrap row lib/auth.js writes
--    when the seeded cellar is claimed): that address already belongs to
--    this Domaine as a Cellarmaster, so it's recorded as exactly that.
ALTER TABLE "Invite" ADD COLUMN "domaineId" TEXT;
ALTER TABLE "Invite" ADD COLUMN "access" TEXT;

UPDATE "Invite" SET "domaineId" = (
    SELECT "domaineId" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1
);
UPDATE "Invite" i SET "access" = 'cellarmaster'
FROM "User" u
WHERE u."email" = i."email" AND u."domaineId" = i."domaineId";
UPDATE "Invite" SET "access" = 'separate' WHERE "access" IS NULL;

ALTER TABLE "Invite" ALTER COLUMN "domaineId" SET NOT NULL;
ALTER TABLE "Invite" ALTER COLUMN "access" SET NOT NULL;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Invite_domaineId_idx" ON "Invite"("domaineId");

-- 4. A guest-role member's favorites identity: a Guest row found by its
--    User rather than by a cookie. Null for every existing (cookie) guest.
ALTER TABLE "Guest" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Guest_userId_key" ON "Guest"("userId");
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
