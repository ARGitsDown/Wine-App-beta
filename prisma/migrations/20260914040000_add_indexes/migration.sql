-- CreateIndex
CREATE INDEX "Bottle_status_idx" ON "Bottle"("status");

-- CreateIndex
CREATE INDEX "Bottle_needsResearch_idx" ON "Bottle"("needsResearch");

-- CreateIndex
CREATE INDEX "BottlePhoto_bottleId_idx" ON "BottlePhoto"("bottleId");

-- CreateIndex
CREATE INDEX "TastingNote_bottleId_idx" ON "TastingNote"("bottleId");

-- CreateIndex
CREATE INDEX "Favorite_bottleId_idx" ON "Favorite"("bottleId");

-- CreateIndex
CREATE INDEX "FlightPick_flightId_idx" ON "FlightPick"("flightId");

-- CreateIndex
CREATE INDEX "FlightPick_bottleId_idx" ON "FlightPick"("bottleId");
