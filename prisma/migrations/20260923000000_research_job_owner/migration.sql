-- ResearchJob needs its owner recorded as data rather than read from a
-- live session: the step that processes it runs from a plain HTTP route
-- hit by a server-to-server fetch with no session attached (see the
-- schema comment on ResearchJob.ownerId, and app/api/research/step/route.js).
--
-- Same nullable-backfill-lock shape as the original ownership migration:
-- add nullable, fill every existing row, then lock it down. Any job rows
-- already on file predate multi-user scoping entirely, so they backfill to
-- whichever user was created first - the same choice the original
-- migration made for Bottle/TastingFlight/SavedPairing.

ALTER TABLE "ResearchJob" ADD COLUMN "ownerId" TEXT;

UPDATE "ResearchJob"
SET "ownerId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);

ALTER TABLE "ResearchJob" ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ResearchJob_ownerId_idx" ON "ResearchJob"("ownerId");
