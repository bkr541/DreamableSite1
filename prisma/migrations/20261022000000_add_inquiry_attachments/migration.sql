-- CreateTable
CREATE TABLE "inquiry_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "inquiry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiry_attachments_inquiry_id_idx" ON "inquiry_attachments"("inquiry_id");

-- AddForeignKey
ALTER TABLE "inquiry_attachments" ADD CONSTRAINT "inquiry_attachments_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
