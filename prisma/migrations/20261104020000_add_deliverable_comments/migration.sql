-- Comments left on a single artifact by anyone who has its folder's shared link.
CREATE TABLE IF NOT EXISTS "deliverable_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliverable_id" UUID NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    CONSTRAINT "deliverable_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deliverable_comments_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "deliverable_comments_deliverable_id_idx" ON "deliverable_comments"("deliverable_id");
