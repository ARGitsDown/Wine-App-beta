-- Bottle.status is one of four words. Until now only the code kept it so; a
-- direct call to a server action could store any string. NOT VALID enforces the
-- rule on every new or changed row without scanning (or failing a deploy on)
-- rows that already exist - none should be wrong, and a later VALIDATE
-- CONSTRAINT would prove it.
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_status_known"
  CHECK ("status" IN ('inventory', 'wishlist', 'consumed', 'flight')) NOT VALID;

-- Entries made before BottleTrash.listedIn existed carry the list in their
-- snapshot; it is knowable, so it is filled in rather than left as "unknown".
UPDATE "BottleTrash"
SET "listedIn" = "snapshot"->'bottle'->>'status'
WHERE "listedIn" IS NULL
  AND "snapshot"->'bottle'->>'status' IN ('inventory', 'wishlist', 'consumed', 'flight');
