-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('USER', 'BOT');

-- CreateEnum
CREATE TYPE "SubmissionVerdict" AS ENUM ('PENDING', 'AC', 'WA', 'TLE', 'MLE', 'RE', 'CE');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PREPARING', 'RUNNING', 'ENDED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "contests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "seed" BIGINT NOT NULL,
    "difficultyMin" INTEGER NOT NULL,
    "difficultyMax" INTEGER NOT NULL,
    "problemCount" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "status" "ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_problems" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "problemRating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_participants" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "type" "ParticipantType" NOT NULL DEFAULT 'USER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER NOT NULL DEFAULT 0,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,

    CONSTRAINT "contest_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "participantRowId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "verdict" "SubmissionVerdict" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER NOT NULL DEFAULT 0,
    "executionTimeMs" INTEGER,
    "testResultsJson" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "judgedAt" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_challenges" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botRating" INTEGER NOT NULL,
    "simulationRunId" TEXT,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PREPARING',
    "outcome" TEXT,
    "resultEventId" TEXT,
    "ratingBefore" INTEGER,
    "ratingAfter" INTEGER,
    "ratingDelta" INTEGER,
    "resultAppliedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contests_status_idx" ON "contests"("status");

-- CreateIndex
CREATE INDEX "contests_startsAt_idx" ON "contests"("startsAt");

-- CreateIndex
CREATE INDEX "contest_problems_problemId_idx" ON "contest_problems"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "contest_problems_contestId_problemId_key" ON "contest_problems"("contestId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "contest_problems_contestId_ordinal_key" ON "contest_problems"("contestId", "ordinal");

-- CreateIndex
CREATE INDEX "contest_participants_participantId_idx" ON "contest_participants"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "contest_participants_contestId_participantId_type_key" ON "contest_participants"("contestId", "participantId", "type");

-- CreateIndex
CREATE INDEX "submissions_contestId_participantRowId_idx" ON "submissions"("contestId", "participantRowId");

-- CreateIndex
CREATE INDEX "submissions_contestId_problemId_idx" ON "submissions"("contestId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_challenges_contestId_key" ON "bot_challenges"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_challenges_simulationRunId_key" ON "bot_challenges"("simulationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_challenges_resultEventId_key" ON "bot_challenges"("resultEventId");

-- CreateIndex
CREATE INDEX "bot_challenges_userId_createdAt_idx" ON "bot_challenges"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bot_challenges_botId_idx" ON "bot_challenges"("botId");

-- CreateIndex
CREATE INDEX "bot_challenges_status_idx" ON "bot_challenges"("status");

-- AddForeignKey
ALTER TABLE "contest_problems" ADD CONSTRAINT "contest_problems_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_participants" ADD CONSTRAINT "contest_participants_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_participantRowId_fkey" FOREIGN KEY ("participantRowId") REFERENCES "contest_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_contestId_problemId_fkey" FOREIGN KEY ("contestId", "problemId") REFERENCES "contest_problems"("contestId", "problemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_challenges" ADD CONSTRAINT "bot_challenges_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
