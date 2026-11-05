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
