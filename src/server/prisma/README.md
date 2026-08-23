# Prisma

Owns the Prisma schema, PostgreSQL migrations, seed infrastructure, and database qualification assets. PostgreSQL is the business source of truth.

The baseline migration creates `platform_metadata`. Readiness queries this table so an reachable but
unmigrated database is not reported as ready. Runtime connections use the matching Prisma
PostgreSQL driver adapter.

Migrations must preserve tenant isolation, same-tenant relationships, durable outbox data, and safe forward deployment.
