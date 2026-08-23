-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('DRAFT', 'READY', 'DISABLED');

-- CreateEnum
CREATE TYPE "SolutionSource" AS ENUM ('EDITORIAL', 'CURATED', 'EXTERNAL', 'AI_GENERATED');

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'codeforces',
    "sourceContestId" INTEGER,
    "sourceIndex" TEXT,
    "title" TEXT NOT NULL,
    "rating" INTEGER,
    "tags" TEXT[],
    "concepts" TEXT[],
    "statement" TEXT NOT NULL,
    "inputFormat" TEXT,
    "outputFormat" TEXT,
    "constraints" TEXT,
    "examplesJson" JSONB,
    "notes" TEXT,
    "editorial" TEXT,
    "timeLimitMs" INTEGER NOT NULL,
    "memoryLimitMb" INTEGER NOT NULL,
    "solutionCode" TEXT,
    "solutionSource" "SolutionSource",
    "solutionSourceRef" TEXT,
    "generatorCode" TEXT,
    "generatorVersion" INTEGER,
    "generatorHash" TEXT,
    "testcaseArtifactJson" JSONB,
    "deterministic" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProblemStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problems_rating_idx" ON "problems"("rating");

-- CreateIndex
CREATE INDEX "problems_status_deterministic_idx" ON "problems"("status", "deterministic");

-- CreateIndex
CREATE INDEX "problems_sourceContestId_sourceIndex_idx" ON "problems"("sourceContestId", "sourceIndex");

-- CreateIndex
CREATE UNIQUE INDEX "problems_source_sourceContestId_sourceIndex_key" ON "problems"("source", "sourceContestId", "sourceIndex");
