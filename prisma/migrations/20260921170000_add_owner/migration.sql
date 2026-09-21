-- Phase 0 of separate cellars per user: ownership exists, nothing reads it.
--
-- The whole point of this being its own migration is that it is the only
-- step in the plan that rewrites every row of live data. It runs in one
-- transaction, so it either happens completely or not at all - there is no
-- state where some bottles have an owner and others do not.
--
-- Order matters and is the standard nullable-backfill-lock dance: a column
-- cannot be added NOT NULL to a table that already has rows, so it arrives
-- nullable, gets filled, and only then is locked down.

-- 1. The owner table, shaped as Auth.js's User from the start so Phase 1
--    can hand it to @auth/prisma-adapter without moving ownership again.
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- 2. The one owner every existing row belongs to. A fixed, readable id
--    rather than a generated one: this row is referenced by the backfill
--    below, and a deterministic value means the same migration produces
--    the same result in every environment and can be read by eye
--    afterwards. Real users get cuids from the adapter.
--
--    Email is deliberately left NULL. Setting it would be a guess at which
--    Google account will eventually sign in, and a wrong guess is worse
--    than none - see FUTURE_CAPABILITIES.md for what Phase 1 must do to
--    link this row to a real sign-in rather than stranding the cellar.
INSERT INTO "User" ("id", "name", "email", "createdAt")
VALUES ('seed-owner', 'Cellar owner', NULL, CURRENT_TIMESTAMP);

-- 3. Nullable first, because these tables have rows.
ALTER TABLE "Bottle" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "TastingFlight" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "SavedPairing" ADD COLUMN "ownerId" TEXT;

-- 4. Everything that exists today belongs to the one owner. This is the
--    step that touches every row.
UPDATE "Bottle" SET "ownerId" = 'seed-owner';
UPDATE "TastingFlight" SET "ownerId" = 'seed-owner';
UPDATE "SavedPairing" SET "ownerId" = 'seed-owner';

-- 5. Locked down. From here a row without an owner is a database error
--    rather than a silent orphan, which is the property Phase 2's scoping
--    will depend on: "every row has an owner" has to be true before
--    "only show rows owned by you" can be safe.
ALTER TABLE "Bottle" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "TastingFlight" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "SavedPairing" ALTER COLUMN "ownerId" SET NOT NULL;

-- 6. Foreign keys and indexes. Postgres does not index a foreign key on
--    its own, and once Phase 2 scopes queries this is the column every one
--    of them filters on.
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TastingFlight" ADD CONSTRAINT "TastingFlight_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPairing" ADD CONSTRAINT "SavedPairing_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Bottle_ownerId_idx" ON "Bottle"("ownerId");
CREATE INDEX "TastingFlight_ownerId_idx" ON "TastingFlight"("ownerId");
CREATE INDEX "SavedPairing_ownerId_idx" ON "SavedPairing"("ownerId");
