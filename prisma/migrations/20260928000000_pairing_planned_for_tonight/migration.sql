-- "Drink tonight" (BACKLOG #28/#39): a plain owner-set flag on the whole
-- pairing, cleared only by the owner's own "Done for tonight" action -
-- see the schema comment on SavedPairing.plannedForTonight for why this
-- is deliberately not derived or auto-cleared. Every existing pairing
-- predates the feature and none of them are "tonight's" by default.

ALTER TABLE "SavedPairing" ADD COLUMN "plannedForTonight" BOOLEAN NOT NULL DEFAULT false;
