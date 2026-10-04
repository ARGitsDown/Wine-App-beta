-- "We drank it" on a saved pairing: the fact, separate from the Drink intent.
ALTER TABLE "PairingPick" ADD COLUMN "drankAt" TIMESTAMP(3);
ALTER TABLE "PairingPick" ADD COLUMN "drankTookBottle" BOOLEAN NOT NULL DEFAULT false;

-- Prisma doesn't model CHECK constraints. A plain "decision" = 'drink' would
-- pass when decision is NULL (NULL is not false), hence the COALESCE.
ALTER TABLE "PairingPick" ADD CONSTRAINT "PairingPick_drank_was_planned" CHECK (
  "drankAt" IS NULL OR COALESCE("decision", '') = 'drink'
);
ALTER TABLE "PairingPick" ADD CONSTRAINT "PairingPick_took_bottle_was_drunk" CHECK (
  NOT "drankTookBottle" OR "drankAt" IS NOT NULL
);
