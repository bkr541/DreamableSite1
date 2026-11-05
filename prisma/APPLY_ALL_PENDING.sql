-- ALL PENDING MIGRATIONS, in order. Paste this whole file into the Supabase SQL editor and run it once.
-- Every statement is idempotent, so running it again, or after running some of these already, is safe.
-- Requires the earlier tables (users, inquiries, deliverables, deliverable_folders, deliverable_comments, invoices, ...).
-- The invoices section records what it found in invoice_migration_audit, and the LAST section (canonical services) records every
-- rewritten service name in service_migration_audit: review both afterwards (queries at the end of each).

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

-- ═══════════════════════════════════════════════════════════════════════
-- 20261105040000_invoice_integrity
-- ═══════════════════════════════════════════════════════════════════════
-- Invoice integrity: unique numbers, exact money, validation backstops and links to real clients/projects.
-- Idempotent and NON-DESTRUCTIVE: no invoice is deleted, renumbered, re-priced or re-assigned by guesswork.
-- Everything it finds is written to invoice_migration_audit so you can review it (see the queries at the end).
-- Run in the Supabase SQL editor BEFORE deploying. (Optional dry look first: prisma/audits/invoices_before_migration.sql)

-- ── 1. Support tables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "invoice_counters" (
  "year"       INTEGER NOT NULL,
  "last_value" INTEGER NOT NULL,
  CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("year")
);
CREATE TABLE IF NOT EXISTS "invoice_migration_audit" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "invoice_id" UUID,
  "kind"       TEXT        NOT NULL,
  "detail"     JSONB,
  CONSTRAINT "invoice_migration_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "invoice_migration_audit_kind_idx"       ON "invoice_migration_audit"("kind");
CREATE INDEX IF NOT EXISTS "invoice_migration_audit_invoice_id_idx" ON "invoice_migration_audit"("invoice_id");
ALTER TABLE "invoice_counters"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_migration_audit" ENABLE ROW LEVEL SECURITY;

-- ── 2. Links to the real client / company / project (all optional; set null if the target is deleted) ──
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "client_user_id"  UUID;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "company_id"      UUID;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "project_id"      UUID;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "number_conflict" BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_client_user_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_company_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_project_id_fkey') THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "invoices_client_user_id_idx" ON "invoices"("client_user_id");

-- ── 3. Exact money: Float → Decimal. First record what would change, then convert (once). ──
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'invoice_line_items' AND column_name = 'rate') = 'double precision' THEN

    -- Totals as they were computed before (sum, then tax, then round) vs. under exact per-line rounding.
    INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
    SELECT t.id, 'TOTAL_WOULD_CHANGE', jsonb_build_object('invoice_number', t.invoice_number, 'old_total', t.old_total, 'new_total', t.new_total)
    FROM (
      SELECT i.id, i.invoice_number,
             round(coalesce(l.raw, 0)::numeric * (1 + i.tax_rate::numeric), 2) AS old_total,
             coalesce(l.sub, 0) + round(coalesce(l.sub, 0) * round(i.tax_rate::numeric, 6), 2) AS new_total
      FROM invoices i
      LEFT JOIN (SELECT invoice_id, sum(qty * rate) AS raw, sum(round(round(qty::numeric, 4) * round(rate::numeric, 4), 2)) AS sub
                 FROM invoice_line_items GROUP BY invoice_id) l ON l.invoice_id = i.id
    ) t WHERE t.old_total <> t.new_total;

    -- Values with more precision than the new columns hold, and values that break the new rules.
    INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
    SELECT li.invoice_id, 'LOSSY_AMOUNT', jsonb_build_object('line', li.description, 'qty', li.qty::text, 'rate', li.rate::text)
    FROM invoice_line_items li WHERE li.qty::numeric <> round(li.qty::numeric, 4) OR li.rate::numeric <> round(li.rate::numeric, 4);
    INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
    SELECT i.id, 'LOSSY_TAX', jsonb_build_object('invoice_number', i.invoice_number, 'tax_rate', i.tax_rate::text) FROM invoices i WHERE i.tax_rate::numeric <> round(i.tax_rate::numeric, 6);
    INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
    SELECT li.invoice_id, 'INVALID_AMOUNT', jsonb_build_object('line', li.description, 'qty', li.qty::text, 'rate', li.rate::text)
    FROM invoice_line_items li WHERE li.qty <= 0 OR li.rate < 0;
    INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
    SELECT i.id, 'INVALID_TAX', jsonb_build_object('invoice_number', i.invoice_number, 'tax_rate', i.tax_rate::text) FROM invoices i WHERE i.tax_rate < 0 OR i.tax_rate > 0.5;

    ALTER TABLE invoice_line_items ALTER COLUMN qty  TYPE NUMERIC(12,4) USING round(qty::numeric, 4);
    ALTER TABLE invoice_line_items ALTER COLUMN rate TYPE NUMERIC(14,4) USING round(rate::numeric, 4);
    ALTER TABLE invoices ALTER COLUMN tax_rate DROP DEFAULT;
    ALTER TABLE invoices ALTER COLUMN tax_rate TYPE NUMERIC(9,6) USING round(tax_rate::numeric, 6);
    ALTER TABLE invoices ALTER COLUMN tax_rate SET DEFAULT 0;
  END IF;
END $$;

-- Other legacy values that break the new rules (reported only; nothing is edited).
INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
SELECT i.id, 'INVALID_DATE_OR_STATUS', jsonb_build_object('invoice_number', i.invoice_number, 'issue_date', i.issue_date, 'due_date', i.due_date, 'status', i.status)
FROM invoices i
WHERE (i.issue_date !~ '^\d{4}-\d{2}-\d{2}$' OR i.due_date !~ '^\d{4}-\d{2}-\d{2}$' OR i.due_date < i.issue_date OR i.status NOT IN ('Unsent', 'Not Paid', 'Paid'))
  AND NOT EXISTS (SELECT 1 FROM invoice_migration_audit a WHERE a.invoice_id = i.id AND a.kind = 'INVALID_DATE_OR_STATUS');

-- ── 4. Unique invoice numbers. Duplicates are flagged for a human, never silently renumbered. ──
WITH flagged AS (
  UPDATE invoices SET number_conflict = true
  WHERE id IN (
    SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY lower(btrim(invoice_number)) ORDER BY created_at, id) AS rn FROM invoices) ranked WHERE rn > 1
  ) AND number_conflict = false
  RETURNING id, invoice_number
)
INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
SELECT id, 'DUPLICATE_NUMBER', jsonb_build_object('invoice_number', invoice_number, 'action', 'flagged; number left unchanged, needs a manual new number') FROM flagged;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_unique" ON "invoices" (lower(btrim("invoice_number"))) WHERE "number_conflict" = false;

-- The counter continues after the highest DS-YYYY-NNN already in use (hand-typed numbers included).
INSERT INTO invoice_counters (year, last_value)
SELECT substring(invoice_number FROM '^DS-(\d{4})-\d+$')::int, max(substring(invoice_number FROM '^DS-\d{4}-(\d+)$')::int)
FROM invoices WHERE invoice_number ~ '^DS-\d{4}-\d+$' GROUP BY 1
ON CONFLICT (year) DO UPDATE SET last_value = GREATEST(invoice_counters.last_value, EXCLUDED.last_value);

-- ── 5. Link legacy invoices to real accounts — only when it is unambiguous. ──
-- An email belongs to exactly one client AND something else agrees (the billed name, the company, or a project of theirs).
-- Anything else is recorded as needing review and stays unlinked, so customers never see an invoice on a guess.
WITH cand AS (
  SELECT i.id AS invoice_id, u.id AS user_id, u.company_id,
         (lower(btrim(i.client_name)) = lower(btrim(u.name))) AS name_match,
         (lower(btrim(coalesce(i.client_company, ''))) <> '' AND lower(btrim(i.client_company)) = lower(btrim(coalesce(c.name, '')))) AS company_match,
         EXISTS (SELECT 1 FROM projects p WHERE (p.primary_user_id = u.id OR (u.company_id IS NOT NULL AND p.company_id = u.company_id)) AND lower(btrim(p.name)) = lower(btrim(i.project_name))) AS project_match,
         count(*) OVER (PARTITION BY i.id) AS candidates
  FROM invoices i
  JOIN users u ON lower(btrim(u.email)) = lower(btrim(i.client_email)) AND u.admin = false
  LEFT JOIN companies c ON c.id = u.company_id
  WHERE i.client_user_id IS NULL
), linked AS (
  UPDATE invoices i SET client_user_id = c.user_id, company_id = c.company_id
  FROM cand c WHERE i.id = c.invoice_id AND c.candidates = 1 AND (c.name_match OR c.company_match OR c.project_match)
  RETURNING i.id, i.client_user_id, c.name_match, c.company_match, c.project_match
)
INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
SELECT id, 'LINKED_TO_CLIENT', jsonb_build_object('client_user_id', client_user_id, 'name_match', name_match, 'company_match', company_match, 'project_match', project_match) FROM linked;

-- A project is attached only if the linked client has exactly one project with that name.
WITH one AS (
  SELECT i.id AS invoice_id, (array_agg(p.id))[1] AS project_id
  FROM invoices i
  JOIN users u ON u.id = i.client_user_id
  JOIN projects p ON (p.primary_user_id = u.id OR (u.company_id IS NOT NULL AND p.company_id = u.company_id)) AND lower(btrim(p.name)) = lower(btrim(i.project_name))
  WHERE i.project_id IS NULL GROUP BY i.id HAVING count(*) = 1
), set_project AS (
  UPDATE invoices i SET project_id = o.project_id FROM one o WHERE i.id = o.invoice_id RETURNING i.id, i.project_id
)
INSERT INTO invoice_migration_audit (invoice_id, kind, detail) SELECT id, 'LINKED_TO_PROJECT', jsonb_build_object('project_id', project_id) FROM set_project;

INSERT INTO invoice_migration_audit (invoice_id, kind, detail)
SELECT i.id,
       CASE WHEN m.n = 0 THEN 'LINK_UNMATCHED' WHEN m.n > 1 THEN 'LINK_AMBIGUOUS' ELSE 'LINK_UNCORROBORATED' END,
       jsonb_build_object('invoice_number', i.invoice_number, 'client_name', i.client_name, 'client_email', i.client_email, 'clients_with_that_email', m.n,
                          'action', 'left unlinked: customers cannot see it until an admin links it (edit the invoice and choose the client)')
FROM invoices i
CROSS JOIN LATERAL (SELECT count(*) AS n FROM users u WHERE lower(btrim(u.email)) = lower(btrim(i.client_email)) AND u.admin = false) m
WHERE i.client_user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM invoice_migration_audit a WHERE a.invoice_id = i.id AND a.kind IN ('LINK_UNMATCHED', 'LINK_AMBIGUOUS', 'LINK_UNCORROBORATED'));

-- ── 6. Database-level backstops for NEW and edited rows. NOT VALID: existing rows are not re-checked (and not rejected). ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_qty_positive') THEN
    ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_qty_positive CHECK (qty > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_rate_non_negative') THEN
    ALTER TABLE invoice_line_items ADD CONSTRAINT invoice_line_items_rate_non_negative CHECK (rate >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tax_rate_range') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 0.5) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_allowed') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_status_allowed CHECK (status IN ('Unsent', 'Not Paid', 'Paid')) NOT VALID;
  END IF;
END $$;

-- ── Review what the migration found ──
--   SELECT kind, count(*) FROM invoice_migration_audit GROUP BY 1 ORDER BY 1;
--   SELECT a.kind, i.invoice_number, a.detail FROM invoice_migration_audit a LEFT JOIN invoices i ON i.id = a.invoice_id ORDER BY a.kind, i.invoice_number;
--   Invoices still needing a human:  SELECT invoice_number, client_name, client_email FROM invoices WHERE client_user_id IS NULL;
--   Flagged duplicate numbers:       SELECT invoice_number, client_name FROM invoices WHERE number_conflict;

-- ═══════════════════════════════════════════════════════════════════════
-- 20261105050000_canonical_services
-- ═══════════════════════════════════════════════════════════════════════
-- One name per service. Rewrites older spellings to the canonical name (lib/services.catalog.mjs) in
-- inquiries.service, projects.service and the services table, and records every change in service_migration_audit.
-- Idempotent and non-destructive: values we don't recognise are left exactly as they are, and nothing is deleted
-- except a duplicate legacy row in the services table (after its sub-categories are moved to the canonical one).
-- Run in the Supabase SQL editor. Safe while the old code is live: it still understands every spelling.
--
-- Matching ignores case, surrounding spaces and the "&" / "and" difference. The list below is written from the catalog
-- (the canonical labels plus LEGACY_ALIASES); tests/services.test.ts fails if this file and the catalog disagree.

CREATE TABLE IF NOT EXISTS "service_migration_audit" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "table_name" TEXT        NOT NULL,
  "row_id"     TEXT        NOT NULL,
  "old_value"  TEXT        NOT NULL,
  "new_value"  TEXT        NOT NULL,
  CONSTRAINT "service_migration_audit_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "service_migration_audit" ENABLE ROW LEVEL SECURITY;

-- 1. Inquiries and projects: record the old value, then rewrite only values that differ from the canonical name.
-- inquiries
INSERT INTO service_migration_audit (table_name, row_id, old_value, new_value)
WITH a(alias_key, canonical) AS (VALUES
    ('branding and identity', 'Brand Identity'),
    ('branding and logo', 'Brand Identity'),
    ('app or web development', 'App or Web Development'),
    ('brand identity', 'Brand Identity'),
    ('ui ux design', 'UI/UX Design'),
    ('marketing and ads', 'Marketing & Ads'),
    ('consulting', 'Consulting'),
    ('support', 'Support'),
    ('other', 'Other'))
SELECT 'inquiries', t.id::text, t.service, a.canonical FROM inquiries t JOIN a ON btrim(regexp_replace(replace(lower(coalesce(t.service, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g')) = a.alias_key WHERE t.service <> a.canonical;

WITH a(alias_key, canonical) AS (VALUES
    ('branding and identity', 'Brand Identity'),
    ('branding and logo', 'Brand Identity'),
    ('app or web development', 'App or Web Development'),
    ('brand identity', 'Brand Identity'),
    ('ui ux design', 'UI/UX Design'),
    ('marketing and ads', 'Marketing & Ads'),
    ('consulting', 'Consulting'),
    ('support', 'Support'),
    ('other', 'Other'))
UPDATE inquiries t SET service = a.canonical FROM a WHERE btrim(regexp_replace(replace(lower(coalesce(t.service, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g')) = a.alias_key AND t.service <> a.canonical;

-- projects
INSERT INTO service_migration_audit (table_name, row_id, old_value, new_value)
WITH a(alias_key, canonical) AS (VALUES
    ('branding and identity', 'Brand Identity'),
    ('branding and logo', 'Brand Identity'),
    ('app or web development', 'App or Web Development'),
    ('brand identity', 'Brand Identity'),
    ('ui ux design', 'UI/UX Design'),
    ('marketing and ads', 'Marketing & Ads'),
    ('consulting', 'Consulting'),
    ('support', 'Support'),
    ('other', 'Other'))
SELECT 'projects', t.id::text, t.service, a.canonical FROM projects t JOIN a ON btrim(regexp_replace(replace(lower(coalesce(t.service, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g')) = a.alias_key WHERE t.service <> a.canonical;

WITH a(alias_key, canonical) AS (VALUES
    ('branding and identity', 'Brand Identity'),
    ('branding and logo', 'Brand Identity'),
    ('app or web development', 'App or Web Development'),
    ('brand identity', 'Brand Identity'),
    ('ui ux design', 'UI/UX Design'),
    ('marketing and ads', 'Marketing & Ads'),
    ('consulting', 'Consulting'),
    ('support', 'Support'),
    ('other', 'Other'))
UPDATE projects t SET service = a.canonical FROM a WHERE btrim(regexp_replace(replace(lower(coalesce(t.service, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g')) = a.alias_key AND t.service <> a.canonical;

-- 2. The services table (what the admin pickers list). A legacy row is renamed; if the canonical row already exists
--    its sub-categories move across (skipping ones it already has) and the leftover legacy row is removed.
DO $$
DECLARE
  legacy RECORD;
  canon_id UUID;
BEGIN
  FOR legacy IN
    WITH a(alias_key, canonical) AS (VALUES
    ('branding and identity', 'Brand Identity'),
    ('branding and logo', 'Brand Identity'),
    ('app or web development', 'App or Web Development'),
    ('brand identity', 'Brand Identity'),
    ('ui ux design', 'UI/UX Design'),
    ('marketing and ads', 'Marketing & Ads'),
    ('consulting', 'Consulting'),
    ('support', 'Support'),
    ('other', 'Other'))
    SELECT s.id, s.name, a.canonical FROM services s JOIN a ON btrim(regexp_replace(replace(lower(coalesce(s.name, '')), '&', ' and '), '[^a-z0-9]+', ' ', 'g')) = a.alias_key WHERE s.name <> a.canonical
  LOOP
    SELECT id INTO canon_id FROM services WHERE name = legacy.canonical;
    IF canon_id IS NULL THEN
      UPDATE services SET name = legacy.canonical WHERE id = legacy.id;
    ELSE
      UPDATE service_sub_categories sc SET service_id = canon_id
       WHERE sc.service_id = legacy.id
         AND NOT EXISTS (SELECT 1 FROM service_sub_categories x WHERE x.service_id = canon_id AND x.name = sc.name);
      DELETE FROM services WHERE id = legacy.id;   -- its remaining (duplicate) sub-categories go with it
    END IF;
    INSERT INTO service_migration_audit (table_name, row_id, old_value, new_value) VALUES ('services', legacy.id::text, legacy.name, legacy.canonical);
  END LOOP;
END $$;

-- Check afterwards (every service should now have exactly one spelling):
--   SELECT service, count(*) FROM inquiries GROUP BY 1 ORDER BY 1;
--   SELECT service, count(*) FROM projects GROUP BY 1 ORDER BY 1;
--   SELECT name FROM services ORDER BY "order";
--   SELECT table_name, old_value, new_value, count(*) FROM service_migration_audit GROUP BY 1, 2, 3;
