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
