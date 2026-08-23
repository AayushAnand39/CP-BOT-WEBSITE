-- CreateTable
CREATE TABLE "user_competitive_events" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "opponentRating" INTEGER,
    "result" TEXT,
    "ratingBefore" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "ratingDelta" INTEGER NOT NULL,
    "statsDeltaJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_competitive_events_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "user_competitive_events_userId_createdAt_idx" ON "user_competitive_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_competitive_events_eventType_idx" ON "user_competitive_events"("eventType");

-- AddForeignKey
ALTER TABLE "user_competitive_events" ADD CONSTRAINT "user_competitive_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
