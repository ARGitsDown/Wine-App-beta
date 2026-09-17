-- Nullable first, backfilled, then locked down - same shape as the
-- emptiedAt-follows-tasting-note migration for the same reason: the exact
-- producer isn't recoverable from the stored wineLabel without guessing
-- (which quoted bottling name, which 4-digit number is a vintage rather
-- than part of the name), so existing rows get the full wineLabel as their
-- wineName rather than a parsed approximation. Correct, if longer than
-- ideal for a list summary, until the pairing is refined and re-saved.
-- Every row written from here on gets the producer alone, computed at save
-- time (see savePairing in app/actions.js).
ALTER TABLE "PairingPick" ADD COLUMN "wineName" TEXT;

UPDATE "PairingPick" SET "wineName" = "wineLabel" WHERE "wineName" IS NULL;

ALTER TABLE "PairingPick" ALTER COLUMN "wineName" SET NOT NULL;
