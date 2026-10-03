-- Who runs the app (pays for the API key, sets other Domaines' AI limits) is
-- now stored data - one flagged account - instead of being re-derived on
-- every request as "any Cellarmaster of the earliest account's Domaine".
-- That rule made every Cellarmaster of the original Domaine an operator, and
-- silently moved the role to the next-oldest account (possibly in a
-- different Domaine) if the earliest one was ever removed.
--
-- NOT NULL DEFAULT false is safe: "false" is a true statement about every
-- account but one, not a guess.
ALTER TABLE "User" ADD COLUMN "isAppOwner" BOOLEAN NOT NULL DEFAULT false;

-- The earliest-created account, with the same tiebreak the runtime uses
-- (createdAt, then id) - the seeded cellar's owner, whose Domaine the
-- usage migration (20260929000000) already left unlimited.
UPDATE "User" SET "isAppOwner" = true
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
