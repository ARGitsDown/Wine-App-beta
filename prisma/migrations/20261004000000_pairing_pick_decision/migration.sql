-- One column: the owner's decision about a wine in a saved pairing.
-- NULL = undecided (the default; existing rows stay that way).
ALTER TABLE "PairingPick" ADD COLUMN "decision" TEXT;

-- Prisma doesn't model CHECK constraints, so this is invisible to
-- `migrate diff` and doesn't show as drift.
ALTER TABLE "PairingPick" ADD CONSTRAINT "PairingPick_decision_known" CHECK (
  "decision" IS NULL OR "decision" IN ('drink', 'hold')
);
