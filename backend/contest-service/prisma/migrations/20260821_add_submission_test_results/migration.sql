ALTER TABLE "submissions"
ADD COLUMN IF NOT EXISTS "testResultsJson" JSONB;
