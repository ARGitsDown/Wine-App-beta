-- "Drink tonight" becomes a planned day. Anything marked for tonight keeps its
-- place: its day is the day it was marked (or today, for rows marked before
-- that was recorded), anchored at noon UTC like every other picked date.
ALTER TABLE "SavedPairing" ADD COLUMN "plannedFor" TIMESTAMP(3);

UPDATE "SavedPairing"
SET "plannedFor" = (COALESCE("plannedForTonightAt", now()) AT TIME ZONE 'UTC')::date + TIME '12:00'
WHERE "plannedForTonight";

ALTER TABLE "SavedPairing" DROP COLUMN "plannedForTonight";
ALTER TABLE "SavedPairing" DROP COLUMN "plannedForTonightAt";
