-- CreateTable
CREATE TABLE "DrinkWindowEstimate" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "drinkFrom" INTEGER,
    "drinkTo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrinkWindowEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrinkWindowEstimate_key_key" ON "DrinkWindowEstimate"("key");
