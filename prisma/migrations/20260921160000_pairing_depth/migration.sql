-- Suggest's dial stopped being a thinking budget and became a model
-- choice, so the column that records which setting was in force records a
-- different fact and takes a different name.
--
-- Every existing row ran on Opus - that was the only model Suggest ever
-- used, whichever of the three effort levels was picked - so they all
-- become 'sommelier'. Mapping by the old *labels* instead (the level named
-- "Quick" becoming the rung named "Standard") would have been the tidier
-- looking migration and a false one: it would record that a pairing was
-- answered by Sonnet when it was not, and refining it would then quietly
-- run a different model than the one whose answer is on the page.
ALTER TABLE "SavedPairing" RENAME COLUMN "effort" TO "depth";

UPDATE "SavedPairing" SET "depth" = 'sommelier';
