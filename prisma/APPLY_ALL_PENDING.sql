-- ALL PENDING MIGRATIONS, in order. Paste this whole file into the Supabase SQL editor and run it once.
-- Every statement is idempotent (IF NOT EXISTS / ON CONFLICT / guarded UPDATEs), so running it again, or after
-- running some of these already, is safe. Requires the earlier tables (users, inquiries, deliverables,
-- deliverable_folders, deliverable_comments, ...) which you already have.

-- ═══════════════════════════════════════════════════════════════════════
-- 20261104030000_security_hardening
-- ═══════════════════════════════════════════════════════════════════════
-- Security hardening: session revocation, single-use reset links, audit trail, account-status normalisation.
-- Idempotent. Run in the Supabase SQL editor BEFORE deploying the matching code.
-- Safe to run while the old code is live: it only adds columns/tables and normalises status text.

-- 1. Session revocation counter (existing users start at 0).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;

-- 2. Who approved an inquiry.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "approved_by_id" UUID;

-- 3. Single-use password reset / setup links (only a keyed hash of the token is stored).
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id"     UUID        NOT NULL,
  "token_hash"  TEXT        NOT NULL,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- 4. Append-only audit trail for privileged actions.
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "actor_id"    UUID,
  "action"      TEXT        NOT NULL,
  "target_type" TEXT        NOT NULL,
  "target_id"   TEXT,
  "metadata"    JSONB,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_target_idx" ON "audit_logs"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- Same posture as the other tables: no direct access through Supabase's public API.
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- 5. Normalise historical users.status values. Login now requires exactly 'ACTIVE', and unknown values fail closed,
--    so nobody who could sign in before is locked out and nobody gets reactivated.
UPDATE "users" SET "status" = upper(btrim("status")) WHERE "status" <> upper(btrim("status"));
-- Admins created by scripts/SQL always had a working password.
UPDATE "users" SET "status" = 'ACTIVE' WHERE "admin" = true AND "status" IN ('INVITED', 'ONBOARDING', 'COMPLETED');
-- Legacy values the old "Add client" form could write (ONBOARDING/COMPLETED) and INVITED accounts that already
-- signed in (login used to ignore status): signed in before => ACTIVE, never signed in => INVITED (finish setup by email).
UPDATE "users" SET "status" = 'ACTIVE'  WHERE "status" IN ('INVITED', 'ONBOARDING', 'COMPLETED') AND "last_login_at" IS NOT NULL;
UPDATE "users" SET "status" = 'INVITED' WHERE "status" IN ('ONBOARDING', 'COMPLETED');

-- Review after running (anything not ACTIVE/INVITED/SUSPENDED cannot sign in):
--   SELECT status, count(*) FROM users GROUP BY status;

-- ═══════════════════════════════════════════════════════════════════════
-- 20261105000000_abuse_protection
-- ═══════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════
-- 20261105010000_files_sharing_archive
-- ═══════════════════════════════════════════════════════════════════════
-- Files in object storage, share-link rotation, and inquiry archiving.
-- Idempotent and ADDITIVE: no data is moved, rewritten or deleted. Run in the Supabase SQL editor BEFORE deploying.
-- Safe while the old code is live (it keeps reading/writing bytes in the database exactly as before).

-- 1. Object-storage columns. Existing rows keep their bytes in "data" (status READY) and keep working.
ALTER TABLE "deliverables"        ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "deliverables"        ADD COLUMN IF NOT EXISTS "storage_key" TEXT;
ALTER TABLE "deliverables"        ADD COLUMN IF NOT EXISTS "sha256"      TEXT;
ALTER TABLE "deliverables"        ADD COLUMN IF NOT EXISTS "status"      TEXT NOT NULL DEFAULT 'READY';
CREATE UNIQUE INDEX IF NOT EXISTS "deliverables_storage_key_key" ON "deliverables"("storage_key");
CREATE INDEX IF NOT EXISTS "deliverables_status_created_at_idx"  ON "deliverables"("status", "created_at");

ALTER TABLE "inquiry_attachments" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "inquiry_attachments" ALTER COLUMN "inquiry_id" DROP NOT NULL;  -- NULL while a public upload waits to be claimed
ALTER TABLE "inquiry_attachments" ADD COLUMN IF NOT EXISTS "storage_key" TEXT;
ALTER TABLE "inquiry_attachments" ADD COLUMN IF NOT EXISTS "sha256"      TEXT;
ALTER TABLE "inquiry_attachments" ADD COLUMN IF NOT EXISTS "status"      TEXT NOT NULL DEFAULT 'READY';
CREATE UNIQUE INDEX IF NOT EXISTS "inquiry_attachments_storage_key_key" ON "inquiry_attachments"("storage_key");
CREATE INDEX IF NOT EXISTS "inquiry_attachments_status_created_at_idx"  ON "inquiry_attachments"("status", "created_at");

-- 2. Share-link rotation.
ALTER TABLE "deliverable_folders" ADD COLUMN IF NOT EXISTS "share_rotated_at" TIMESTAMPTZ;

-- 3. Inquiry archiving.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "archived_at"    TIMESTAMPTZ;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "archived_by_id" UUID;
CREATE INDEX IF NOT EXISTS "inquiries_archived_at_idx" ON "inquiries"("archived_at");

-- 4. A lead record can no longer take client work with it. Folders and files that belong to an inquiry now
--    BLOCK its deletion instead of cascading. (Deleting a *project* is still an explicit admin action and
--    still removes that project's own folders and files.)
ALTER TABLE "deliverables" DROP CONSTRAINT IF EXISTS "deliverables_inquiry_id_fkey";
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_inquiry_id_fkey"
  FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deliverable_folders" DROP CONSTRAINT IF EXISTS "deliverable_folders_inquiry_id_fkey";
ALTER TABLE "deliverable_folders" ADD CONSTRAINT "deliverable_folders_inquiry_id_fkey"
  FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checks afterwards:
--   SELECT status, count(*) FROM deliverables GROUP BY 1;          -- all READY
--   SELECT status, count(*) FROM inquiry_attachments GROUP BY 1;   -- all READY
--   SELECT count(*) FROM deliverables WHERE data IS NULL AND storage_key IS NULL;   -- must be 0

-- ═══════════════════════════════════════════════════════════════════════
-- 20261105020000_email_outbox_notifications
-- ═══════════════════════════════════════════════════════════════════════
-- Reliable email (durable outbox) and the admin notification feed.
-- Idempotent and purely additive. Run in the Supabase SQL editor BEFORE deploying.

CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "event_type"      TEXT        NOT NULL,
  "recipient"       TEXT        NOT NULL,
  "dedupe_key"      TEXT        NOT NULL,
  "payload"         JSONB,
  "status"          TEXT        NOT NULL DEFAULT 'PENDING',
  "attempts"        INTEGER     NOT NULL DEFAULT 0,
  "max_attempts"    INTEGER     NOT NULL DEFAULT 8,
  "manual_retries"  INTEGER     NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "locked_until"    TIMESTAMPTZ,
  "last_error"      TEXT,
  "sent_at"         TIMESTAMPTZ,
  "entity_type"     TEXT,
  "entity_id"       TEXT,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_dedupe_key_key"      ON "email_outbox"("dedupe_key");
CREATE INDEX        IF NOT EXISTS "email_outbox_status_next_idx"     ON "email_outbox"("status", "next_attempt_at");
CREATE INDEX        IF NOT EXISTS "email_outbox_created_at_idx"      ON "email_outbox"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "type"        TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "body"        TEXT,
  "entity_type" TEXT,
  "entity_id"   TEXT,
  "url"         TEXT        NOT NULL,
  "actor_id"    UUID,
  "dedupe_key"  TEXT        NOT NULL,
  CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_notifications_dedupe_key_key" ON "admin_notifications"("dedupe_key");
CREATE INDEX        IF NOT EXISTS "admin_notifications_created_at_idx" ON "admin_notifications"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "notification_reads" (
  "notification_id" UUID        NOT NULL,
  "user_id"         UUID        NOT NULL,
  "read_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id", "user_id"),
  CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "admin_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "notification_reads_user_id_idx" ON "notification_reads"("user_id");

-- Same posture as the other tables: reachable only through the application, not Supabase's public API.
ALTER TABLE "email_outbox"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_notifications"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_reads"   ENABLE ROW LEVEL SECURITY;

-- Nothing is backfilled: the feed starts empty and fills with real events from this point on.
-- Check afterwards:
--   SELECT status, count(*) FROM email_outbox GROUP BY 1;

-- ═══════════════════════════════════════════════════════════════════════
-- 20261105030000_review_and_invitations
-- ═══════════════════════════════════════════════════════════════════════
-- Inquiry rejection and invitation tokens. Idempotent and additive. Run in the Supabase SQL editor BEFORE deploying.

-- 1. Rejecting an inquiry (internal reason, who and when). Existing rows are unaffected.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "rejected_at"      TIMESTAMPTZ;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "rejected_by_id"   UUID;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

-- 2. Emailed links now say what they are for. Everything issued so far was a password-reset link, which is
--    exactly what the default records; an invitation is a different, longer-lived, single-purpose token.
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'RESET';

-- 3. Clients created before this change had a random, unknowable password hash. They could never sign in with
--    it, so it is cleared: they get in through an invitation (Clients → Resend invite) or "Forgot password".
--    Accounts that have ever signed in, and admins, are left exactly as they are.
UPDATE "users" SET "password_hash" = NULL
 WHERE "status" = 'INVITED' AND "last_login_at" IS NULL AND "admin" = false AND "password_hash" IS NOT NULL;

-- Check afterwards:
--   SELECT status, (password_hash IS NULL) AS no_password, count(*) FROM users GROUP BY 1, 2;
