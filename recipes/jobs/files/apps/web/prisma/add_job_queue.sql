-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('waiting', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "job" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT,
    "payload" JSONB NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'waiting',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_state_run_after_idx" ON "job"("state", "run_after");

-- CreateIndex
CREATE INDEX "job_kind_key_idx" ON "job"("kind", "key");

