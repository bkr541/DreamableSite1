-- ── Schema (generated from prisma/schema.prisma) ──────────────────────────────
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "website" TEXT,
    "service" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budget_range" TEXT,
    "timeline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "approved_at" TIMESTAMPTZ,
    "source" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "utm_content" TEXT,
    "referrer" TEXT,
    "metadata" JSONB,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID,
    "company_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "templogincode" TEXT,
    "temp_login_code_expires_at" TIMESTAMPTZ,
    "invited_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_sub_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoice_number" TEXT NOT NULL,
    "issue_date" TEXT NOT NULL,
    "due_date" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT NOT NULL,
    "client_company" TEXT,
    "project_name" TEXT NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Unsent',

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inquiry_id" UUID,
    "company_id" UUID NOT NULL,
    "primary_user_id" UUID,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "sub_category" TEXT,
    "description" TEXT NOT NULL,
    "budget_range" TEXT,
    "timeline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "start_date" DATE,
    "target_end_date" DATE,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_created_at_idx" ON "inquiries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "inquiries_status_idx" ON "inquiries"("status");

-- CreateIndex
CREATE INDEX "inquiries_email_idx" ON "inquiries"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_inquiry_id_key" ON "users"("inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_inquiry_id_key" ON "companies"("inquiry_id");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "services_order_idx" ON "services"("order");

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE INDEX "service_sub_categories_order_idx" ON "service_sub_categories"("order");

-- CreateIndex
CREATE UNIQUE INDEX "service_sub_categories_service_id_name_key" ON "service_sub_categories"("service_id", "name");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_client_email_idx" ON "invoices"("client_email");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_inquiry_id_key" ON "projects"("inquiry_id");

-- CreateIndex
CREATE INDEX "projects_company_id_idx" ON "projects"("company_id");

-- CreateIndex
CREATE INDEX "projects_primary_user_id_idx" ON "projects"("primary_user_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_sub_categories" ADD CONSTRAINT "service_sub_categories_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_primary_user_id_fkey" FOREIGN KEY ("primary_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Lock down Supabase's public REST API (Prisma connects as postgres and bypasses RLS) ──
ALTER TABLE "inquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_sub_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

-- ── Seed: services and sub-categories (from prisma/seed.mjs) ─────────────────
INSERT INTO "services" ("name", "order") VALUES ('App or Web Development', 0) ON CONFLICT ("name") DO UPDATE SET "order" = EXCLUDED."order";
INSERT INTO "service_sub_categories" ("service_id", "name", "order")
SELECT id, v.name, v.ord FROM "services", (VALUES
  ('Custom Web Applications', 0),
  ('SaaS Development', 1),
  ('Mobile App Development (iOS / Android / Cross-platform)', 2),
  ('Landing Pages & Marketing Sites', 3),
  ('E-commerce Development', 4),
  ('API Development & Integrations', 5),
  ('Database Architecture & Backend Systems', 6),
  ('Performance Optimization & Scaling', 7),
  ('Maintenance & Support', 8),
  ('MVP Development', 9)
) AS v(name, ord) WHERE "services"."name" = 'App or Web Development'
ON CONFLICT ("service_id", "name") DO UPDATE SET "order" = EXCLUDED."order";

INSERT INTO "services" ("name", "order") VALUES ('Branding & Identity', 1) ON CONFLICT ("name") DO UPDATE SET "order" = EXCLUDED."order";
INSERT INTO "service_sub_categories" ("service_id", "name", "order")
SELECT id, v.name, v.ord FROM "services", (VALUES
  ('Logo Design & Logo Systems', 0),
  ('Brand Identity Systems', 1),
  ('Brand Strategy & Positioning', 2),
  ('Naming & Tagline Development', 3),
  ('Visual Direction & Moodboards', 4),
  ('Brand Guidelines / Style Guides', 5),
  ('Rebranding / Brand Refresh', 6),
  ('Social Media Branding Kits', 7),
  ('Merchandise & Packaging Design', 8),
  ('Creative Direction', 9)
) AS v(name, ord) WHERE "services"."name" = 'Branding & Identity'
ON CONFLICT ("service_id", "name") DO UPDATE SET "order" = EXCLUDED."order";

INSERT INTO "services" ("name", "order") VALUES ('UI/UX Design', 2) ON CONFLICT ("name") DO UPDATE SET "order" = EXCLUDED."order";
INSERT INTO "service_sub_categories" ("service_id", "name", "order")
SELECT id, v.name, v.ord FROM "services", (VALUES
  ('User Experience (UX) Research', 0),
  ('Wireframing & User Flows', 1),
  ('High-Fidelity UI Design', 2),
  ('Design Systems & Component Libraries', 3),
  ('Prototyping (Interactive Demos)', 4),
  ('Usability Testing', 5),
  ('Mobile App UI Design', 6),
  ('Dashboard / SaaS Interface Design', 7),
  ('Conversion Optimization (CRO)', 8),
  ('Accessibility Design', 9)
) AS v(name, ord) WHERE "services"."name" = 'UI/UX Design'
ON CONFLICT ("service_id", "name") DO UPDATE SET "order" = EXCLUDED."order";

INSERT INTO "services" ("name", "order") VALUES ('Consulting', 3) ON CONFLICT ("name") DO UPDATE SET "order" = EXCLUDED."order";
INSERT INTO "service_sub_categories" ("service_id", "name", "order")
SELECT id, v.name, v.ord FROM "services", (VALUES
  ('Product Strategy', 0),
  ('Startup MVP Planning', 1),
  ('Technical Architecture Consulting', 2),
  ('UX Audits & Heuristic Evaluations', 3),
  ('Brand Strategy Consulting', 4),
  ('Growth Strategy', 5),
  ('Monetization Strategy', 6),
  ('App / Website Performance Audits', 7),
  ('Team & Workflow Optimization', 8),
  ('Creative Direction Consulting', 9)
) AS v(name, ord) WHERE "services"."name" = 'Consulting'
ON CONFLICT ("service_id", "name") DO UPDATE SET "order" = EXCLUDED."order";

INSERT INTO "services" ("name", "order") VALUES ('Support', 4) ON CONFLICT ("name") DO UPDATE SET "order" = EXCLUDED."order";
INSERT INTO "service_sub_categories" ("service_id", "name", "order")
SELECT id, v.name, v.ord FROM "services", (VALUES
  ('Technical Support', 0)
) AS v(name, ord) WHERE "services"."name" = 'Support'
ON CONFLICT ("service_id", "name") DO UPDATE SET "order" = EXCLUDED."order";

INSERT INTO "services" ("name", "order") VALUES ('Other', 5) ON CONFLICT ("name") DO UPDATE SET "order" = EXCLUDED."order";
INSERT INTO "service_sub_categories" ("service_id", "name", "order")
SELECT id, v.name, v.ord FROM "services", (VALUES
  ('AI Integrations', 0),
  ('Automation & Workflow Systems', 1),
  ('Motion Graphics & Microinteractions', 2),
  ('3D / Visual Assets', 3),
  ('Content Creation', 4),
  ('Pitch Deck & Presentation Design', 5),
  ('DJ / Music Branding Packages', 6),
  ('Experimental / Concept Projects', 7),
  ('Custom Requests', 8)
) AS v(name, ord) WHERE "services"."name" = 'Other'
ON CONFLICT ("service_id", "name") DO UPDATE SET "order" = EXCLUDED."order";

