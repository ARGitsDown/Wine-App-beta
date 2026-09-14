-- CreateTable
CREATE TABLE "ResearchProposal" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "proposed" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "sources" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchProposal_bottleId_key" ON "ResearchProposal"("bottleId");

-- AddForeignKey
ALTER TABLE "ResearchProposal" ADD CONSTRAINT "ResearchProposal_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
