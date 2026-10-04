-- A recycle bin for wines deleted from their own page: a label and a JSON
-- snapshot, 30 days, restorable with the original id. Additive.
CREATE TABLE "BottleTrash" (
    "id" SERIAL NOT NULL,
    "domaineId" TEXT NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BottleTrash_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BottleTrash_domaineId_deletedAt_idx" ON "BottleTrash"("domaineId", "deletedAt");

ALTER TABLE "BottleTrash" ADD CONSTRAINT "BottleTrash_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
