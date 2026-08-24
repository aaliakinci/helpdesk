CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');
CREATE TYPE "SlaMilestoneStatus" AS ENUM ('ACTIVE', 'APPROACHING', 'BREACHED', 'COMPLETED');

ALTER TABLE "audit_entries"
    ADD COLUMN "actor_type" "AuditActorType" NOT NULL DEFAULT 'USER',
    ALTER COLUMN "actor_user_id" DROP NOT NULL;

ALTER TABLE "ticket_status_history"
    ADD COLUMN "actor_type" "AuditActorType" NOT NULL DEFAULT 'USER',
    ALTER COLUMN "actor_user_id" DROP NOT NULL;

ALTER TABLE "audit_entries"
    ADD CONSTRAINT "audit_entries_actor_check" CHECK (
        ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL)
        OR ("actor_type" = 'SYSTEM' AND "actor_user_id" IS NULL)
    );

ALTER TABLE "ticket_status_history"
    ADD CONSTRAINT "ticket_status_history_actor_check" CHECK (
        ("actor_type" = 'USER' AND "actor_user_id" IS NOT NULL)
        OR ("actor_type" = 'SYSTEM' AND "actor_user_id" IS NULL)
    );

CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "auto_close_resolved_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sla_policies_version_check" CHECK ("version" > 0),
    CONSTRAINT "sla_policies_auto_close_check" CHECK (
        "auto_close_resolved_minutes" BETWEEN 60 AND 43200
    )
);

CREATE TABLE "sla_policy_targets" (
    "tenant_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "first_response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "approaching_before_minutes" INTEGER NOT NULL,
    CONSTRAINT "sla_policy_targets_pkey" PRIMARY KEY ("tenant_id", "policy_id", "priority"),
    CONSTRAINT "sla_policy_targets_duration_check" CHECK (
        "first_response_minutes" BETWEEN 2 AND 43200
        AND "resolution_minutes" BETWEEN 2 AND 43200
        AND "approaching_before_minutes" BETWEEN 1 AND 43199
        AND "approaching_before_minutes" < "first_response_minutes"
        AND "approaching_before_minutes" < "resolution_minutes"
    )
);

CREATE TABLE "ticket_sla_states" (
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "policy_version" INTEGER NOT NULL,
    "priority_snapshot" "TicketPriority" NOT NULL,
    "first_response_minutes_snapshot" INTEGER NOT NULL,
    "resolution_minutes_snapshot" INTEGER NOT NULL,
    "approaching_before_minutes_snapshot" INTEGER NOT NULL,
    "auto_close_resolved_minutes_snapshot" INTEGER NOT NULL,
    "first_response_due_at" TIMESTAMPTZ(3) NOT NULL,
    "resolution_due_at" TIMESTAMPTZ(3) NOT NULL,
    "first_response_approaching_at" TIMESTAMPTZ(3) NOT NULL,
    "resolution_approaching_at" TIMESTAMPTZ(3) NOT NULL,
    "first_response_status" "SlaMilestoneStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolution_status" "SlaMilestoneStatus" NOT NULL DEFAULT 'ACTIVE',
    "first_response_completed_at" TIMESTAMPTZ(3),
    "resolution_completed_at" TIMESTAMPTZ(3),
    "first_response_approaching_sent_at" TIMESTAMPTZ(3),
    "first_response_breached_at" TIMESTAMPTZ(3),
    "resolution_approaching_sent_at" TIMESTAMPTZ(3),
    "resolution_breached_at" TIMESTAMPTZ(3),
    "auto_close_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ticket_sla_states_pkey" PRIMARY KEY ("tenant_id", "ticket_id"),
    CONSTRAINT "ticket_sla_states_snapshot_check" CHECK (
        "policy_version" > 0
        AND "version" > 0
        AND "first_response_minutes_snapshot" BETWEEN 2 AND 43200
        AND "resolution_minutes_snapshot" BETWEEN 2 AND 43200
        AND "approaching_before_minutes_snapshot" BETWEEN 1 AND 43199
        AND "approaching_before_minutes_snapshot" < "first_response_minutes_snapshot"
        AND "approaching_before_minutes_snapshot" < "resolution_minutes_snapshot"
        AND "auto_close_resolved_minutes_snapshot" BETWEEN 60 AND 43200
    ),
    CONSTRAINT "ticket_sla_states_due_order_check" CHECK (
        "first_response_approaching_at" < "first_response_due_at"
        AND "resolution_approaching_at" < "resolution_due_at"
    )
);

CREATE UNIQUE INDEX "sla_policies_tenant_id_key" ON "sla_policies"("tenant_id");
CREATE UNIQUE INDEX "sla_policies_tenant_id_id_key" ON "sla_policies"("tenant_id", "id");
CREATE INDEX "ticket_sla_first_response_due_idx"
    ON "ticket_sla_states"("first_response_status", "first_response_approaching_at", "first_response_due_at");
CREATE INDEX "ticket_sla_resolution_due_idx"
    ON "ticket_sla_states"("resolution_status", "resolution_approaching_at", "resolution_due_at");
CREATE INDEX "ticket_sla_auto_close_idx" ON "ticket_sla_states"("auto_close_at");

ALTER TABLE "sla_policies"
    ADD CONSTRAINT "sla_policies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sla_policy_targets"
    ADD CONSTRAINT "sla_policy_targets_tenant_policy_fkey"
    FOREIGN KEY ("tenant_id", "policy_id") REFERENCES "sla_policies"("tenant_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_sla_states"
    ADD CONSTRAINT "ticket_sla_states_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_sla_states"
    ADD CONSTRAINT "ticket_sla_states_tenant_ticket_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_sla_states"
    ADD CONSTRAINT "ticket_sla_states_tenant_policy_fkey"
    FOREIGN KEY ("tenant_id", "policy_id") REFERENCES "sla_policies"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
