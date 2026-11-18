-- The admin Inbox: which Zoho Mailbox the site is connected to.
-- Idempotent and purely additive (a new table; nothing existing is touched). Run in the Supabase SQL editor BEFORE deploying.
-- The refresh token is stored ENCRYPTED (AES-256-GCM, key derived from RESET_SECRET): the database never holds it in the clear.
-- At most one row is used: connecting again replaces it. Message bodies are never stored; they are fetched live from Zoho.

CREATE TABLE IF NOT EXISTS "zoho_connections" (
  "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "region"             TEXT        NOT NULL DEFAULT 'com',
  "account_id"         TEXT        NOT NULL,
  "mailbox_address"    TEXT        NOT NULL,
  "refresh_token_enc"  TEXT        NOT NULL,
  "connected_by_id"    UUID,
  CONSTRAINT "zoho_connections_pkey" PRIMARY KEY ("id")
);

-- Same posture as every other table: the app reaches it only through the server (Prisma); the public API gets nothing.
ALTER TABLE "zoho_connections" ENABLE ROW LEVEL SECURITY;

-- Check afterwards:
--   SELECT mailbox_address, region, created_at FROM zoho_connections;
