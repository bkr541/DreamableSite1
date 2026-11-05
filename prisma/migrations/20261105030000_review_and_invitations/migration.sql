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
