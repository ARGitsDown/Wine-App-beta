-- The rules the usage-limits form enforces, held by the database too: the
-- app checks them in one action, but createUser writes limits without going
-- through it, a hand edit bypasses both, and a negative cost would quietly
-- reduce a Domaine's month. Prisma doesn't model CHECK constraints, so they
-- are invisible to `migrate diff` and don't show as drift.
--
-- NULL still means "no limit of this kind" and is allowed everywhere; a
-- hard stop is never below the cap when both are set.
ALTER TABLE "Domaine" ADD CONSTRAINT "Domaine_limits_sane" CHECK (
  ("monthlySpendCapCents" IS NULL OR "monthlySpendCapCents" >= 0)
  AND ("monthlyHardStopCents" IS NULL OR "monthlyHardStopCents" >= 0)
  AND ("monthlySpendCapCents" IS NULL OR "monthlyHardStopCents" IS NULL
       OR "monthlyHardStopCents" >= "monthlySpendCapCents")
);

ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_nonnegative" CHECK (
  "costMicros" >= 0
  AND "inputTokens" >= 0
  AND "outputTokens" >= 0
  AND "cacheCreationInputTokens" >= 0
  AND "cacheReadInputTokens" >= 0
  AND "webSearches" >= 0
);
