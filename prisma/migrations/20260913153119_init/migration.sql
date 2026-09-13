-- CreateTable
CREATE TABLE "Bottle" (
    "id" SERIAL NOT NULL,
    "producer" TEXT NOT NULL,
    "vintage" INTEGER,
    "variety" TEXT,
    "region" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'wishlist',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TastingNote" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tastedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TastingNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TastingNote" ADD CONSTRAINT "TastingNote_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
