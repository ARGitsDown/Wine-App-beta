-- Distinguishes a FlightPick whose bottle was already Tasted (never Cellar
-- inventory - e.g. scanned straight to Tasted at a wine-tasting event) at
-- the moment it joined its flight, from one that became consumed later by
-- actually pouring it during the flight. See the schema comment on
-- FlightPick.startedConsumed.
--
-- Existing rows all predate this distinction, and every one of them came
-- from a bottle that genuinely was Cellar inventory at add-time (the only
-- path that existed before today) - false is the correct backfill, not a
-- placeholder, so no separate backfill step is needed.

ALTER TABLE "FlightPick" ADD COLUMN "startedConsumed" BOOLEAN NOT NULL DEFAULT false;
