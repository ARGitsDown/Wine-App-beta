-- Usage limits per Domaine (FUTURE_CAPABILITIES.md, Phase 3): a ledger of
-- Claude calls, and a monthly cap and hard stop on each Domaine.

-- 1. The limits. Nullable: null means "no limit of this kind".
ALTER TABLE "Domaine" ADD COLUMN "monthlySpendCapCents" INTEGER;
ALTER TABLE "Domaine" ADD COLUMN "monthlyHardStopCents" INTEGER;

-- 2. Every Domaine except the app owner's gets the default limits: $5 a
--    month, with the hard stop at three times that. The app owner is the
--    earliest-created account's Domaine - the same convention the invite
--    backfill (20260928050000) used, and the cellar this app started as -
--    and stays null, i.e. unlimited. These are starting values, chosen
--    before there is any real spend to look at; the app owner changes any
--    Domaine's on /usage, and the defaults for new ones come from
--    USAGE_DEFAULT_CAP_CENTS / USAGE_HARD_STOP_MULTIPLIER (lib/usage-policy.js).
UPDATE "Domaine"
SET "monthlySpendCapCents" = 500, "monthlyHardStopCents" = 1500
WHERE "id" <> COALESCE(
  (SELECT "domaineId" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1),
  ''
);

-- 3. The ledger.
CREATE TABLE "UsageEvent" (
    "id" SERIAL NOT NULL,
    "domaineId" TEXT NOT NULL,
    "ownerId" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "lighter" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationInputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadInputTokens" INTEGER NOT NULL DEFAULT 0,
    "webSearches" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageEvent_domaineId_createdAt_idx" ON "UsageEvent"("domaineId", "createdAt");
CREATE INDEX "UsageEvent_ownerId_idx" ON "UsageEvent"("ownerId");

ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_domaineId_fkey"
    FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
