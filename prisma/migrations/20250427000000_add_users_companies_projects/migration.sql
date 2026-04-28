-- AlterTable: add approved_at to inquiries
ALTER TABLE "inquiries" ADD COLUMN "approved_at" TIMESTAMPTZ;

-- CreateTable: companies
CREATE TABLE "companies" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID        UNIQUE,
    "name"       TEXT        NOT NULL,
    "website"    TEXT,
    "status"     TEXT        NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "companies_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "companies_name_idx"   ON "companies"("name");
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateTable: users
CREATE TABLE "users" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id"    UUID        UNIQUE,
    "company_id"    UUID,
    "name"          TEXT        NOT NULL,
    "email"         TEXT        NOT NULL UNIQUE,
    "role"          TEXT        NOT NULL DEFAULT 'CLIENT',
    "status"        TEXT        NOT NULL DEFAULT 'INVITED',
    "invited_at"    TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_inquiry_id_fkey"  FOREIGN KEY ("inquiry_id")  REFERENCES "inquiries"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_company_id_fkey"  FOREIGN KEY ("company_id")  REFERENCES "companies"("id")  ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "users_company_id_idx" ON "users"("company_id");
CREATE INDEX "users_email_idx"      ON "users"("email");
CREATE INDEX "users_status_idx"     ON "users"("status");

-- CreateTable: projects
CREATE TABLE "projects" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id"      UUID        UNIQUE,
    "company_id"      UUID        NOT NULL,
    "primary_user_id" UUID,
    "name"            TEXT        NOT NULL,
    "service"         TEXT        NOT NULL,
    "description"     TEXT        NOT NULL,
    "budget_range"    TEXT,
    "timeline"        TEXT,
    "status"          TEXT        NOT NULL DEFAULT 'ONBOARDING',
    "start_date"      DATE,
    "target_end_date" DATE,
    "completed_at"    TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_inquiry_id_fkey"      FOREIGN KEY ("inquiry_id")      REFERENCES "inquiries"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projects_company_id_fkey"      FOREIGN KEY ("company_id")      REFERENCES "companies"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "projects_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "users"("id")      ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "projects_company_id_idx"      ON "projects"("company_id");
CREATE INDEX "projects_primary_user_id_idx" ON "projects"("primary_user_id");
CREATE INDEX "projects_status_idx"          ON "projects"("status");
CREATE INDEX "projects_created_at_idx"      ON "projects"("created_at" DESC);
