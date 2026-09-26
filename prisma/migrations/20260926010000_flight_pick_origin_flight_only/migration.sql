-- Supersedes the previous migration's "startedConsumed" column before it
-- ever shipped a real distinction: "Flight" moved from a checkbox riding
-- on a shared status to a genuinely independent Bottle.status value
-- ("flight"), so what a FlightPick needs to remember is no longer "did
-- this start pre-consumed" but "did this bottle ever pass through
-- Cellar inventory, or was it flight-only from birth" - see the schema
-- comment on FlightPick.originFlightOnly.
--
-- Existing rows all predate both the checkbox and this column: every one
-- of them came from a bottle that was genuinely Cellar inventory at
-- add-time (the only path that existed until today), so false is the
-- correct backfill for the new column, same as it was for the one this
-- replaces.

ALTER TABLE "FlightPick" DROP COLUMN "startedConsumed";
ALTER TABLE "FlightPick" ADD COLUMN "originFlightOnly" BOOLEAN NOT NULL DEFAULT false;
