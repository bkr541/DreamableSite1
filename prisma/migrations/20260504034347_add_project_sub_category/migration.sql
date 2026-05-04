-- DropIndex
DROP INDEX "service_sub_categories_service_id_idx";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "sub_category" TEXT;
