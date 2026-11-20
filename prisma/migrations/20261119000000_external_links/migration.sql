-- Optional external download links (Dropbox, Google Drive, …) on projects, folders and individual files.
-- Idempotent and purely additive: three new nullable columns, no data is touched. Run in the Supabase SQL editor BEFORE
-- deploying (the new code selects these columns). Safe while the old code is live: it ignores them.

ALTER TABLE "projects"            ADD COLUMN IF NOT EXISTS "external_link" TEXT;
ALTER TABLE "deliverable_folders" ADD COLUMN IF NOT EXISTS "external_link" TEXT;
ALTER TABLE "deliverables"        ADD COLUMN IF NOT EXISTS "external_link" TEXT;

-- Check afterwards:
--   SELECT table_name FROM information_schema.columns WHERE column_name = 'external_link' ORDER BY 1;   -- 3 rows
