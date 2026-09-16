-- Data only: no column changes.
--
-- A drunk bottle now shows one date for the evening it was finished, not
-- two. The card reads it off the newest tasting note; History still sorts
-- on Bottle."emptiedAt". Those two were only ever equal by luck, because
-- emptiedAt was stamped with "now" at the moment the status was flipped
-- while the note's date could be corrected afterwards - so History could
-- sit in an order the dates on screen denied, with no way left to fix it.
--
-- This brings the existing rows into line with what every write does from
-- now on (syncEmptiedToLatestNote in app/actions.js). Only bottles already
-- in History, and only those that have a note to take a date from; a bottle
-- with no note keeps its stamped date, which is still the only record of
-- when it was finished.
UPDATE "Bottle" AS b
SET "emptiedAt" = latest."tastedAt"
FROM (
  SELECT DISTINCT ON ("bottleId") "bottleId", "tastedAt"
  FROM "TastingNote"
  ORDER BY "bottleId", "tastedAt" DESC, "id" DESC
) AS latest
WHERE b."id" = latest."bottleId"
  AND b."status" = 'consumed'
  AND (b."emptiedAt" IS DISTINCT FROM latest."tastedAt");
