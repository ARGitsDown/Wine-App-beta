-- The drinking-window cache is keyed on "the same wine", which is now the app's
-- one definition (producer, bottling, vintage - lib/wine-key.js) instead of one
-- that also included grape and region. Old keys can never be hit again, so they
-- are removed; it is only a cache, and the next estimate of each wine refills it.
DELETE FROM "DrinkWindowEstimate";
