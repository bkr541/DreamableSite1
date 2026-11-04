-- Folders group deliverables; a folder with is_public = true can be opened through its share_token link.
CREATE TABLE IF NOT EXISTS "deliverable_folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID,
    "project_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "share_token" TEXT NOT NULL,

    CONSTRAINT "deliverable_folders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deliverable_folders_target_check" CHECK ("inquiry_id" IS NOT NULL OR "project_id" IS NOT NULL),
    CONSTRAINT "deliverable_folders_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deliverable_folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "deliverable_folders_share_token_key" ON "deliverable_folders"("share_token");
CREATE INDEX IF NOT EXISTS "deliverable_folders_inquiry_id_idx" ON "deliverable_folders"("inquiry_id");
CREATE INDEX IF NOT EXISTS "deliverable_folders_project_id_idx" ON "deliverable_folders"("project_id");

-- Files now live in a folder; the old per-file category is no longer required.
ALTER TABLE "deliverables" ADD COLUMN IF NOT EXISTS "folder_id" UUID;
ALTER TABLE "deliverables" ALTER COLUMN "category" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "deliverables_folder_id_idx" ON "deliverables"("folder_id");
DO $$ BEGIN
  ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "deliverable_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
