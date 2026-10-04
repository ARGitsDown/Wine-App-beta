-- Remembers which wines a CSV import created, so its Undo survives the page.
-- Additive.
CREATE TABLE "ImportBatch" (
    "id" SERIAL NOT NULL,
    "domaineId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bottleIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_domaineId_createdAt_idx" ON "ImportBatch"("domaineId", "createdAt");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_domaineId_fkey" FOREIGN KEY ("domaineId") REFERENCES "Domaine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
