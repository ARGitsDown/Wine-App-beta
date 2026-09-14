-- CreateTable
CREATE TABLE "BottlePhoto" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BottlePhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BottlePhoto" ADD CONSTRAINT "BottlePhoto_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
