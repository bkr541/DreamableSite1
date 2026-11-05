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
