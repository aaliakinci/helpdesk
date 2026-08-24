# Prisma

Owns the Prisma schema, PostgreSQL migrations, seed infrastructure, and database qualification assets. PostgreSQL is the business source of truth.

The baseline migration creates `platform_metadata`. Readiness queries this table so an reachable but
unmigrated database is not reported as ready. Runtime connections use the matching Prisma
PostgreSQL driver adapter.

The identity migration adds global users, tenants, tenant memberships, customers and contacts,
rotating session generations, and identity audit entries. Composite foreign keys enforce
same-tenant customer/contact and membership/session relationships. The deterministic seed reads its
local-only password from `DEMO_SEED_PASSWORD` and stores only scrypt hashes.

The support-core migration adds customer aggregate revisions and history, atomic tenant ticket
counters, tickets, public/internal comments, status history, tags, attachment metadata, business
audit entries, and versioned outbox messages. Composite foreign keys keep ticket relationships in
the same tenant, while unique `(tenant_id, number)` and `(tenant_id, ticket_id, version)` constraints
protect ticket identity and history revisions.

Migrations must preserve tenant isolation, same-tenant relationships, durable outbox data, and safe forward deployment.
