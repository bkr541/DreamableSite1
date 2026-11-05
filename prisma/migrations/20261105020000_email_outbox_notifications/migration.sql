-- Reliable email (durable outbox) and the admin notification feed.
-- Idempotent and purely additive. Run in the Supabase SQL editor BEFORE deploying.

CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "event_type"      TEXT        NOT NULL,
  "recipient"       TEXT        NOT NULL,
  "dedupe_key"      TEXT        NOT NULL,
  "payload"         JSONB,
  "status"          TEXT        NOT NULL DEFAULT 'PENDING',
  "attempts"        INTEGER     NOT NULL DEFAULT 0,
  "max_attempts"    INTEGER     NOT NULL DEFAULT 8,
  "manual_retries"  INTEGER     NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "locked_until"    TIMESTAMPTZ,
  "last_error"      TEXT,
  "sent_at"         TIMESTAMPTZ,
  "entity_type"     TEXT,
  "entity_id"       TEXT,
  CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_outbox_dedupe_key_key"      ON "email_outbox"("dedupe_key");
CREATE INDEX        IF NOT EXISTS "email_outbox_status_next_idx"     ON "email_outbox"("status", "next_attempt_at");
CREATE INDEX        IF NOT EXISTS "email_outbox_created_at_idx"      ON "email_outbox"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "admin_notifications" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "type"        TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "body"        TEXT,
  "entity_type" TEXT,
  "entity_id"   TEXT,
  "url"         TEXT        NOT NULL,
  "actor_id"    UUID,
  "dedupe_key"  TEXT        NOT NULL,
  CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "admin_notifications_dedupe_key_key" ON "admin_notifications"("dedupe_key");
CREATE INDEX        IF NOT EXISTS "admin_notifications_created_at_idx" ON "admin_notifications"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "notification_reads" (
  "notification_id" UUID        NOT NULL,
  "user_id"         UUID        NOT NULL,
  "read_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("notification_id", "user_id"),
  CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "admin_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "notification_reads_user_id_idx" ON "notification_reads"("user_id");

-- Same posture as the other tables: reachable only through the application, not Supabase's public API.
ALTER TABLE "email_outbox"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_notifications"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_reads"   ENABLE ROW LEVEL SECURITY;

-- Nothing is backfilled: the feed starts empty and fills with real events from this point on.
-- Check afterwards:
--   SELECT status, count(*) FROM email_outbox GROUP BY 1;
