-- Project deliverables sharing is opt-in and independent of individual folder links.
CREATE TABLE IF NOT EXISTS "deliverables_shares" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "share_token" TEXT NOT NULL UNIQUE,
  "share_rotated_at" TIMESTAMPTZ,
  CONSTRAINT "deliverables_shares_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "deliverables_shares" ENABLE ROW LEVEL SECURITY;
