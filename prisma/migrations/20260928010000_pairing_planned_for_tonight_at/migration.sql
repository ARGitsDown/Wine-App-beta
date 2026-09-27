-- A UX review found "Tonight" never stopped saying "Tonight" once
-- plannedForTonight was set, since that flag is only ever cleared by an
-- owner's own "Done for tonight" tap (see the schema comment on
-- SavedPairing.plannedForTonight). This timestamp lets the label say
-- "Planned <date> - done?" once the day it was set has passed, without
-- changing when the flag itself clears - see the schema comment on
-- plannedForTonightAt.

ALTER TABLE "SavedPairing" ADD COLUMN "plannedForTonightAt" TIMESTAMP(3);
