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
