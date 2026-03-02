-- Create inquiries table for Dreamable.studio
-- Run this against your Postgres database (Neon, Supabase, Vercel Postgres, etc.)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS inquiries (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  name          TEXT         NOT NULL,
  email         TEXT         NOT NULL,
  company       TEXT,
  website       TEXT,

  service       TEXT         NOT NULL,
  description   TEXT         NOT NULL,
  budget_range  TEXT,
  timeline      TEXT,

  status        TEXT         NOT NULL DEFAULT 'INQUIRY',

  source        TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  referrer      TEXT,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status     ON inquiries (status);
CREATE INDEX IF NOT EXISTS idx_inquiries_email      ON inquiries (email);
