BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "comment_id" UUID,
  ADD COLUMN IF NOT EXISTS "checksum_sha256" CHAR(64),
  ADD COLUMN IF NOT EXISTS "visibility" "TicketCommentVisibility" NOT NULL DEFAULT 'PUBLIC';

ALTER TABLE "attachments"
  DROP CONSTRAINT IF EXISTS "attachments_byte_size_check",
  DROP CONSTRAINT IF EXISTS "attachments_checksum_sha256_check",
  DROP CONSTRAINT IF EXISTS "attachments_comment_tenant_fk";

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_byte_size_check"
    CHECK ("byte_size" > 0 AND "byte_size" <= 10485760),
  ADD CONSTRAINT "attachments_checksum_sha256_check"
    CHECK ("checksum_sha256" IS NULL OR "checksum_sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "attachments_comment_tenant_fk"
    FOREIGN KEY ("tenant_id", "comment_id")
    REFERENCES "ticket_comments" ("tenant_id", "id")
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "attachments_tenant_comment_created_idx"
  ON "attachments" ("tenant_id", "comment_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_entries_tenant_occurred_idx"
  ON "audit_entries" ("tenant_id", "occurred_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "audit_entries_tenant_action_occurred_idx"
  ON "audit_entries" ("tenant_id", "action", "occurred_at" DESC);

INSERT INTO "audit_entries" (
  "id",
  "tenant_id",
  "actor_type",
  "actor_user_id",
  "action",
  "aggregate_type",
  "aggregate_id",
  "metadata",
  "occurred_at"
)
SELECT
  "id",
  "tenant_id",
  'USER'::"AuditActorType",
  "actor_user_id",
  "action",
  "subject_type",
  "subject_id",
  "metadata",
  "occurred_at"
FROM "identity_audit_entries"
ON CONFLICT ("id") DO NOTHING;

CREATE INDEX IF NOT EXISTS "tickets_tenant_subject_trgm_idx"
  ON "tickets" USING GIN ("tenant_id", lower("subject") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tickets_tenant_description_trgm_idx"
  ON "tickets" USING GIN ("tenant_id", lower("description") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "customers_tenant_name_trgm_idx"
  ON "customers" USING GIN ("tenant_id", lower("name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "customer_contacts_tenant_display_name_trgm_idx"
  ON "customer_contacts" USING GIN ("tenant_id", lower("display_name") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "customer_contacts_tenant_email_trgm_idx"
  ON "customer_contacts" USING GIN ("tenant_id", lower("email") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tags_tenant_name_trgm_idx"
  ON "tags" USING GIN ("tenant_id", lower("name") gin_trgm_ops);

COMMIT;
