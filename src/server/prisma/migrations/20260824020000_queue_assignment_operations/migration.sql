CREATE TYPE "QueueStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "QueueMemberStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "TicketAssignmentAction" AS ENUM (
    'QUEUED',
    'ASSIGNED',
    'UNASSIGNED',
    'TAKEN_OVER',
    'ROUND_ROBIN_ASSIGNED'
);

ALTER TABLE "tickets"
    ADD COLUMN "current_queue_id" UUID,
    ADD COLUMN "current_assignee_membership_id" UUID,
    ADD COLUMN "assigned_at" TIMESTAMPTZ(3),
    ADD CONSTRAINT "tickets_assignee_requires_queue_check"
        CHECK ("current_assignee_membership_id" IS NULL OR "current_queue_id" IS NOT NULL);

CREATE TABLE "queues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "status" "QueueStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "queues_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "queue_members" (
    "tenant_id" UUID NOT NULL,
    "queue_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "status" "QueueMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "queue_members_pkey" PRIMARY KEY ("tenant_id", "queue_id", "membership_id")
);

CREATE TABLE "queue_assignment_states" (
    "tenant_id" UUID NOT NULL,
    "queue_id" UUID NOT NULL,
    "last_assigned_membership_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "queue_assignment_states_pkey" PRIMARY KEY ("tenant_id", "queue_id"),
    CONSTRAINT "queue_assignment_states_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "ticket_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" "TicketAssignmentAction" NOT NULL,
    "from_queue_id" UUID,
    "to_queue_id" UUID,
    "from_assignee_membership_id" UUID,
    "to_assignee_membership_id" UUID,
    "version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ticket_assignments_version_check" CHECK ("version" >= 2),
    CONSTRAINT "ticket_assignments_from_assignee_queue_check"
        CHECK ("from_assignee_membership_id" IS NULL OR "from_queue_id" IS NOT NULL),
    CONSTRAINT "ticket_assignments_to_assignee_queue_check"
        CHECK ("to_assignee_membership_id" IS NULL OR "to_queue_id" IS NOT NULL)
);

CREATE UNIQUE INDEX "queues_tenant_id_id_key" ON "queues"("tenant_id", "id");
CREATE UNIQUE INDEX "queues_tenant_name_key" ON "queues"("tenant_id", "name");
CREATE INDEX "queues_tenant_status_name_idx" ON "queues"("tenant_id", "status", "name");
CREATE INDEX "queue_members_tenant_membership_status_idx"
    ON "queue_members"("tenant_id", "membership_id", "status");
CREATE UNIQUE INDEX "ticket_assignments_ticket_version_key"
    ON "ticket_assignments"("tenant_id", "ticket_id", "version");
CREATE INDEX "ticket_assignments_tenant_ticket_occurred_idx"
    ON "ticket_assignments"("tenant_id", "ticket_id", "occurred_at");
CREATE INDEX "ticket_assignments_tenant_queue_occurred_idx"
    ON "ticket_assignments"("tenant_id", "to_queue_id", "occurred_at");
CREATE INDEX "ticket_assignments_tenant_assignee_occurred_idx"
    ON "ticket_assignments"("tenant_id", "to_assignee_membership_id", "occurred_at");
CREATE INDEX "tickets_tenant_queue_status_updated_idx"
    ON "tickets"("tenant_id", "current_queue_id", "status", "updated_at");
CREATE INDEX "tickets_tenant_assignee_status_updated_idx"
    ON "tickets"("tenant_id", "current_assignee_membership_id", "status", "updated_at");

ALTER TABLE "queues"
    ADD CONSTRAINT "queues_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "queue_members"
    ADD CONSTRAINT "queue_members_tenant_queue_fkey"
    FOREIGN KEY ("tenant_id", "queue_id") REFERENCES "queues"("tenant_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "queue_members_tenant_membership_fkey"
    FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "queue_assignment_states"
    ADD CONSTRAINT "queue_assignment_states_tenant_queue_fkey"
    FOREIGN KEY ("tenant_id", "queue_id") REFERENCES "queues"("tenant_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "queue_assignment_states_tenant_membership_fkey"
    FOREIGN KEY ("tenant_id", "last_assigned_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tickets"
    ADD CONSTRAINT "tickets_tenant_current_queue_fkey"
    FOREIGN KEY ("tenant_id", "current_queue_id") REFERENCES "queues"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "tickets_tenant_current_assignee_fkey"
    FOREIGN KEY ("tenant_id", "current_assignee_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ticket_assignments"
    ADD CONSTRAINT "ticket_assignments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ticket_assignments_tenant_ticket_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "tickets"("tenant_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ticket_assignments_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ticket_assignments_tenant_from_queue_fkey"
    FOREIGN KEY ("tenant_id", "from_queue_id") REFERENCES "queues"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ticket_assignments_tenant_to_queue_fkey"
    FOREIGN KEY ("tenant_id", "to_queue_id") REFERENCES "queues"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ticket_assignments_tenant_from_assignee_fkey"
    FOREIGN KEY ("tenant_id", "from_assignee_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ticket_assignments_tenant_to_assignee_fkey"
    FOREIGN KEY ("tenant_id", "to_assignee_membership_id") REFERENCES "tenant_memberships"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
