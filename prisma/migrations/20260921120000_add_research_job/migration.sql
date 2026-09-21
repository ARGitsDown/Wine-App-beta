-- Bulk research's queue, moved out of memory and into a row. Nothing to
-- backfill: a run that was in flight when this ships was living in an
-- invocation that is gone by now either way, which is the whole reason
-- this table exists.
CREATE TABLE "ResearchJob" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "bottleIds" INTEGER[],
    "pendingIds" INTEGER[],
    "researched" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchJob_token_key" ON "ResearchJob"("token");

CREATE INDEX "ResearchJob_status_idx" ON "ResearchJob"("status");
