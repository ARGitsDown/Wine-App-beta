-- CreateTable
CREATE TABLE "SavedPairing" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "includeOutside" BOOLEAN NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingPick" (
    "id" SERIAL NOT NULL,
    "pairingId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "dish" TEXT,
    "reason" TEXT NOT NULL,
    "bottleId" INTEGER,
    "wineLabel" TEXT NOT NULL,
    "gap" JSONB,

    CONSTRAINT "PairingPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PairingPick_pairingId_idx" ON "PairingPick"("pairingId");

-- CreateIndex
CREATE INDEX "PairingPick_bottleId_idx" ON "PairingPick"("bottleId");

-- AddForeignKey
ALTER TABLE "PairingPick" ADD CONSTRAINT "PairingPick_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "SavedPairing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A deleted bottle empties this column rather than taking the pairing row
-- with it: the record of what was drunk with a dish outlives the cellar
-- entry, which is what PairingPick."wineLabel" is there to keep readable.
ALTER TABLE "PairingPick" ADD CONSTRAINT "PairingPick_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
