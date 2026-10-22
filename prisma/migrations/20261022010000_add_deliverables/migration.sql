-- CreateTable
CREATE TABLE "deliverables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID,
    "project_id" UUID,
    "category" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deliverables_target_check" CHECK ("inquiry_id" IS NOT NULL OR "project_id" IS NOT NULL)
);

-- CreateIndex
CREATE INDEX "deliverables_inquiry_id_idx" ON "deliverables"("inquiry_id");
CREATE INDEX "deliverables_project_id_idx" ON "deliverables"("project_id");

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
