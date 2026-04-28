-- AlterTable: add admin flag to users
ALTER TABLE "users" ADD COLUMN "admin" BOOLEAN NOT NULL DEFAULT false;
