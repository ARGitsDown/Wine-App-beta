-- Phase 0 of "Shared cellars" (FUTURE_CAPABILITIES.md): a real Domaine
-- entity, and one Domaine per existing User. Nothing reads either new
-- column yet - the ownership roots (Bottle.ownerId etc.) and
-- lib/scoped-prisma.js are untouched, deliberately a later phase.
--
-- This is the same nullable-backfill-lock dance the original
-- 20260921170000_add_owner migration used for ownerId, run in one
-- transaction so there is no window where some Users have a Domaine and
-- others don't.

-- 1. The estate itself. "_migratedFromUserId" is a scratch column, used
--    only to correlate each backfilled Domaine back to the one User it
--    was created for - dropped again at the end of this same migration,
--    once User.domaineId is populated from it. It is never a real,
--    permanent relation: a Domaine does not belong to a User, a User
--    belongs to a Domaine.
CREATE TABLE "Domaine" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "motto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "_migratedFromUserId" TEXT,

    CONSTRAINT "Domaine_pkey" PRIMARY KEY ("id")
);

-- 2. One new Domaine per existing User, carrying over that User's own
--    domaineName/domaineMotto (about to move here) - never merging two
--    people's previously-separate cellars into one shared Domaine, which
--    is exactly the kind of leak this schema's scoping otherwise exists
--    to prevent. gen_random_uuid() rather than the app's own cuid(): this
--    is a raw migration, not a Prisma Client write, and this table
--    already has one precedent (the seed-owner User itself) for a
--    migration-created id that doesn't look like the app's own format.
INSERT INTO "Domaine" ("id", "name", "motto", "_migratedFromUserId")
SELECT gen_random_uuid()::text, "domaineName", "domaineMotto", "id"
FROM "User";

-- 3. Nullable first, because User already has rows.
ALTER TABLE "User" ADD COLUMN "domaineId" TEXT;
ALTER TABLE "User" ADD COLUMN "role" TEXT;

-- 4. Every existing User was already the sole full-access person in
--    their own cellar, so "cellarmaster" is not a guess - it is simply
--    naming what was already true.
UPDATE "User" u
SET "domaineId" = d."id", "role" = 'cellarmaster'
FROM "Domaine" d
WHERE d."_migratedFromUserId" = u."id";

-- 5. Locked down - one Domaine per User is the decided shape, and every
--    row now has one.
ALTER TABLE "User" ALTER COLUMN "domaineId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "User_domaineId_idx" ON "User"("domaineId");

-- 6. domaineName/domaineMotto migrated to Domaine.name/motto above -
--    drop the originals rather than leaving two copies to drift apart.
ALTER TABLE "User" DROP COLUMN "domaineName";
ALTER TABLE "User" DROP COLUMN "domaineMotto";

-- 7. The scratch correlation column has done its job.
ALTER TABLE "Domaine" DROP COLUMN "_migratedFromUserId";
