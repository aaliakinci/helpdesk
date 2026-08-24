CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "TicketCommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL');
CREATE TYPE "OutboxMessageStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

ALTER TABLE "customers"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT "customers_version_check" CHECK ("version" > 0);

CREATE TABLE "customer_history_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id" UUID NOT NULL,
    "changes" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_history_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_ticket_counters" (
    "tenant_id" UUID NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_ticket_counters_pkey" PRIMARY KEY ("tenant_id"),
    CONSTRAINT "tenant_ticket_counters_last_number_check" CHECK ("last_number" >= 0)
);

CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "requester_contact_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "reopened_from_ticket_id" UUID,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "first_response_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tickets_number_check" CHECK ("number" > 0),
    CONSTRAINT "tickets_version_check" CHECK ("version" > 0),
    CONSTRAINT "tickets_subject_check" CHECK (char_length(btrim("subject")) BETWEEN 3 AND 200),
    CONSTRAINT "tickets_description_check" CHECK (char_length(btrim("description")) BETWEEN 1 AND 10000),
    CONSTRAINT "tickets_resolution_timestamps_check" CHECK (
        (("status" IN ('RESOLVED', 'CLOSED')) AND "resolved_at" IS NOT NULL)
        OR (("status" NOT IN ('RESOLVED', 'CLOSED')) AND "resolved_at" IS NULL)
    ),
    CONSTRAINT "tickets_closed_timestamp_check" CHECK (
        (("status" = 'CLOSED') AND "closed_at" IS NOT NULL)
        OR (("status" <> 'CLOSED') AND "closed_at" IS NULL)
    )
);

CREATE TABLE "ticket_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "visibility" "TicketCommentVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ticket_comments_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 10000)
);

CREATE TABLE "ticket_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "from_status" "TicketStatus",
    "to_status" "TicketStatus" NOT NULL,
    "version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_status_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ticket_status_history_version_check" CHECK ("version" > 0)
);

CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tags_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 60)
);

CREATE TABLE "ticket_tags" (
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "ticket_tags_pkey" PRIMARY KEY ("tenant_id", "ticket_id", "tag_id")
);

CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(120) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attachments_byte_size_check" CHECK ("byte_size" >= 0)
);

CREATE TABLE "audit_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "correlation_id" VARCHAR(128),
    "causation_id" VARCHAR(128),
    "status" "OutboxMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(100),

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_messages_schema_version_check" CHECK ("schema_version" > 0),
    CONSTRAINT "outbox_messages_attempts_check" CHECK ("attempts" >= 0)
);

CREATE INDEX "customer_history_tenant_customer_occurred_idx" ON "customer_history_entries"("tenant_id", "customer_id", "occurred_at");
CREATE UNIQUE INDEX "tickets_tenant_id_id_key" ON "tickets"("tenant_id", "id");
CREATE UNIQUE INDEX "tickets_tenant_number_key" ON "tickets"("tenant_id", "number");
CREATE UNIQUE INDEX "tickets_tenant_reopened_from_key" ON "tickets"("tenant_id", "reopened_from_ticket_id");
CREATE INDEX "tickets_tenant_status_updated_idx" ON "tickets"("tenant_id", "status", "updated_at");
CREATE INDEX "tickets_tenant_requester_updated_idx" ON "tickets"("tenant_id", "requester_contact_id", "updated_at");
CREATE INDEX "tickets_tenant_priority_updated_idx" ON "tickets"("tenant_id", "priority", "updated_at");
CREATE UNIQUE INDEX "ticket_comments_tenant_id_id_key" ON "ticket_comments"("tenant_id", "id");
CREATE INDEX "ticket_comments_tenant_ticket_created_idx" ON "ticket_comments"("tenant_id", "ticket_id", "created_at");
CREATE UNIQUE INDEX "ticket_status_history_ticket_version_key" ON "ticket_status_history"("tenant_id", "ticket_id", "version");
CREATE INDEX "ticket_status_history_tenant_ticket_occurred_idx" ON "ticket_status_history"("tenant_id", "ticket_id", "occurred_at");
CREATE UNIQUE INDEX "tags_tenant_id_id_key" ON "tags"("tenant_id", "id");
CREATE UNIQUE INDEX "tags_tenant_name_key" ON "tags"("tenant_id", "name");
CREATE INDEX "ticket_tags_tenant_tag_ticket_idx" ON "ticket_tags"("tenant_id", "tag_id", "ticket_id");
CREATE UNIQUE INDEX "attachments_tenant_id_id_key" ON "attachments"("tenant_id", "id");
CREATE UNIQUE INDEX "attachments_tenant_storage_key_key" ON "attachments"("tenant_id", "storage_key");
CREATE INDEX "attachments_tenant_ticket_created_idx" ON "attachments"("tenant_id", "ticket_id", "created_at");
CREATE INDEX "audit_entries_tenant_aggregate_occurred_idx" ON "audit_entries"("tenant_id", "aggregate_type", "aggregate_id", "occurred_at");
CREATE INDEX "outbox_messages_status_available_idx" ON "outbox_messages"("status", "available_at", "occurred_at");
CREATE INDEX "outbox_messages_tenant_aggregate_idx" ON "outbox_messages"("tenant_id", "aggregate_type", "aggregate_id", "occurred_at");

ALTER TABLE "customer_history_entries"
    ADD CONSTRAINT "customer_history_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_history_entries"
    ADD CONSTRAINT "customer_history_entries_tenant_id_customer_id_fkey"
    FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_history_entries"
    ADD CONSTRAINT "customer_history_entries_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_ticket_counters"
    ADD CONSTRAINT "tenant_ticket_counters_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_tenant_id_requester_contact_id_fkey"
    FOREIGN KEY ("tenant_id", "requester_contact_id") REFERENCES "customer_contacts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_tenant_id_reopened_from_ticket_id_fkey"
    FOREIGN KEY ("tenant_id", "reopened_from_ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_comments"
    ADD CONSTRAINT "ticket_comments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_comments"
    ADD CONSTRAINT "ticket_comments_tenant_id_ticket_id_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_comments"
    ADD CONSTRAINT "ticket_comments_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_status_history"
    ADD CONSTRAINT "ticket_status_history_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_status_history"
    ADD CONSTRAINT "ticket_status_history_tenant_id_ticket_id_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_status_history"
    ADD CONSTRAINT "ticket_status_history_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tags"
    ADD CONSTRAINT "tags_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags"
    ADD CONSTRAINT "ticket_tags_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags"
    ADD CONSTRAINT "ticket_tags_tenant_id_ticket_id_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_tags"
    ADD CONSTRAINT "ticket_tags_tenant_id_tag_id_fkey"
    FOREIGN KEY ("tenant_id", "tag_id") REFERENCES "tags"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_tenant_id_ticket_id_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments"
    ADD CONSTRAINT "attachments_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_entries"
    ADD CONSTRAINT "audit_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_entries"
    ADD CONSTRAINT "audit_entries_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "outbox_messages"
    ADD CONSTRAINT "outbox_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
