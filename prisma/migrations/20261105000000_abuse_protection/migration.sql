-- Abuse protection: shared rate-limit counters and public-comment moderation.
-- Idempotent. Run in the Supabase SQL editor BEFORE deploying the matching code.
-- Safe while the old code is live: only adds a table and columns with defaults that keep today's behaviour.

-- 1. Shared rate-limit counters (keys are hashed; no emails or IP addresses are stored).
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key"           TEXT        NOT NULL,
  "hits"          INTEGER     NOT NULL,
  "window_start"  TIMESTAMPTZ NOT NULL,
  "strikes"       INTEGER     NOT NULL DEFAULT 0,
  "blocked_until" TIMESTAMPTZ,
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "rate_limits_updated_at_idx" ON "rate_limits"("updated_at");
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;

-- 2. Per-folder comment controls. Existing folders keep working exactly as before:
--    comments stay on, and nothing is held for review.
ALTER TABLE "deliverable_folders" ADD COLUMN IF NOT EXISTS "comments_enabled"   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "deliverable_folders" ADD COLUMN IF NOT EXISTS "comments_moderated" BOOLEAN NOT NULL DEFAULT false;

-- 3. Comment review state. Every existing comment is already public, so it is APPROVED.
ALTER TABLE "deliverable_comments" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'APPROVED';
CREATE INDEX IF NOT EXISTS "deliverable_comments_deliverable_id_status_idx" ON "deliverable_comments"("deliverable_id", "status");

-- Check afterwards:
--   SELECT status, count(*) FROM deliverable_comments GROUP BY status;   -- everything APPROVED
