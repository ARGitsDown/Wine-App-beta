-- CreateTable
CREATE TABLE "TastingFlight" (
    "id" SERIAL NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TastingFlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightPick" (
    "id" SERIAL NOT NULL,
    "flightId" INTEGER NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FlightPick_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FlightPick" ADD CONSTRAINT "FlightPick_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "TastingFlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightPick" ADD CONSTRAINT "FlightPick_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
