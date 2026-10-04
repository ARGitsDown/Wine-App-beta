-- Opt-in cellar digest email. Both nullable: NULL frequency = off (the
-- default for everyone), NULL last-sent = never sent. Additive.
ALTER TABLE "User"
  ADD COLUMN "digestFrequency" TEXT,
  ADD COLUMN "digestLastSentAt" TIMESTAMP(3);

ALTER TABLE "User" ADD CONSTRAINT "User_digestFrequency_known"
  CHECK ("digestFrequency" IS NULL OR "digestFrequency" IN ('weekly', 'monthly'));
