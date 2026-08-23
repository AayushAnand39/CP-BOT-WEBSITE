-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "bots" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "aggression" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "consistency" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tagStrengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tagWeaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_simulation_runs" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedEventKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "liveStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "bot_simulation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bots_slug_key" ON "bots"("slug");

-- CreateIndex
CREATE INDEX "bots_rating_idx" ON "bots"("rating");

-- CreateIndex
CREATE INDEX "bots_enabled_idx" ON "bots"("enabled");

-- CreateIndex
CREATE INDEX "bot_simulation_runs_contestId_idx" ON "bot_simulation_runs"("contestId");

-- CreateIndex
CREATE INDEX "bot_simulation_runs_botId_createdAt_idx" ON "bot_simulation_runs"("botId", "createdAt");

-- AddForeignKey
ALTER TABLE "bot_simulation_runs" ADD CONSTRAINT "bot_simulation_runs_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
