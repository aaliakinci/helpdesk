CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

ALTER TABLE "outbox_messages"
ADD COLUMN "traceparent" VARCHAR(55),
ADD COLUMN "locked_by" VARCHAR(100),
ADD COLUMN "locked_until" TIMESTAMPTZ(3);

DROP INDEX "outbox_messages_status_available_idx";
CREATE INDEX "outbox_messages_status_available_idx"
ON "outbox_messages"("status", "available_at", "locked_until", "occurred_at");

CREATE TABLE "consumed_messages" (
    "consumer_name" VARCHAR(120) NOT NULL,
    "message_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consumed_messages_pkey" PRIMARY KEY ("consumer_name", "message_id")
);

CREATE INDEX "consumed_messages_tenant_consumed_idx"
ON "consumed_messages"("tenant_id", "consumed_at");

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "recipient_membership_id" UUID NOT NULL,
    "ticket_id" UUID,
    "source_message_id" UUID NOT NULL,
    "kind" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_tenant_id_id_key"
ON "notifications"("tenant_id", "id");
CREATE UNIQUE INDEX "notifications_recipient_source_kind_key"
ON "notifications"("tenant_id", "recipient_membership_id", "source_message_id", "kind");
CREATE INDEX "notifications_recipient_unread_created_idx"
ON "notifications"("tenant_id", "recipient_membership_id", "read_at", "created_at");

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "NotificationDeliveryChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "deduplication_key" VARCHAR(200) NOT NULL,
    "delivered_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_deliveries_tenant_dedupe_key"
ON "notification_deliveries"("tenant_id", "deduplication_key");
CREATE INDEX "notification_deliveries_status_created_idx"
ON "notification_deliveries"("tenant_id", "status", "created_at");

ALTER TABLE "consumed_messages"
ADD CONSTRAINT "consumed_messages_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_tenant_id_recipient_membership_id_fkey"
FOREIGN KEY ("tenant_id", "recipient_membership_id")
REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_tenant_id_ticket_id_fkey"
FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries"
ADD CONSTRAINT "notification_deliveries_tenant_id_notification_id_fkey"
FOREIGN KEY ("tenant_id", "notification_id") REFERENCES "notifications"("tenant_id", "id")
ON DELETE CASCADE ON UPDATE CASCADE;
